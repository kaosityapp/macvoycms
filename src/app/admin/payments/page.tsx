import { createClient } from '@/lib/supabase/server';
import { isHelcimConfigured, listCardBatchesWithAmounts, listAchBatchesWithAmounts } from '@/lib/integrations/helcim';
import { summarizePayments } from '@/lib/admin/paymentStatus';
import { todayIso } from '@/lib/billing/dueDates';
import { inputClass } from '@/components/ui';
import { PaymentsTabs, type LateRow, type RecentRow, type UpcomingRow, type BatchRow } from './PaymentsTabs';

export const dynamic = 'force-dynamic';

const FAILED_STATUSES = new Set(['failed', 'expired']);

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const today = todayIso();
  const billingActive = isHelcimConfigured();

  const [dancersRes, recentRes, recentCountRes] = await Promise.all([
    supabase
      .from('family_members')
      .select(
        `id, first_name, last_name,
         payment_plans(id, total_amount, installment_schedule, status, stored_card_token, stored_bank_account_id),
         payments(amount, paid_at)`,
      )
      .eq('status', 'active'),
    supabase
      .from('payments')
      .select('id, amount, category, paid_at, family_members(first_name, last_name)')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .limit(50),
    supabase.from('payments').select('id', { count: 'exact', head: true }),
  ]);

  const dancers = (dancersRes.data ?? []) as any[];
  const activePlanIds = dancers
    .map((m) => (m.payment_plans ?? []).find((p: any) => p.status === 'active')?.id)
    .filter(Boolean) as string[];

  const { data: intentsData } =
    activePlanIds.length > 0
      ? await supabase
          .from('payment_intents')
          .select('payment_plan_id, installment_index, status, created_at, failure_reason')
          .in('payment_plan_id', activePlanIds)
      : { data: [] as any[] };

  // Group attempts by (plan, installment index) — both auto-charge and the
  // family's own "Pay Now" attempts land in the same table.
  const intentsByKey = new Map<string, any[]>();
  for (const intent of intentsData ?? []) {
    if (intent.installment_index == null) continue;
    const key = `${intent.payment_plan_id}-${intent.installment_index}`;
    if (!intentsByKey.has(key)) intentsByKey.set(key, []);
    intentsByKey.get(key)!.push(intent);
  }

  const upcoming: UpcomingRow[] = [];
  const late: LateRow[] = [];
  for (const m of dancers) {
    const plan = (m.payment_plans ?? []).find((p: any) => p.status === 'active') ?? null;
    if (!plan) continue;
    const name = `${m.first_name} ${m.last_name}`;
    const schedule = Array.isArray(plan.installment_schedule) ? plan.installment_schedule : [];
    // Net against what's actually paid — otherwise an installment already
    // covered by a lump-sum or manual payment still counts toward "upcoming",
    // overstating the total Debbie sees as still owed.
    const paidTotal = (m.payments ?? [])
      .filter((p: any) => p.paid_at)
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    let cumulative = 0;
    for (const inst of schedule) {
      cumulative += Number(inst?.amount ?? 0);
      if (inst?.date && inst.date >= today && paidTotal < cumulative - 0.005) {
        upcoming.push({ name, date: inst.date, amount: Number(inst.amount) });
      }
    }

    const s = summarizePayments(plan, m.payments ?? [], today, billingActive);
    if (s.status === 'overdue') {
      const overdueIndex = schedule.findIndex((i: any) => i?.date === s.overdueSinceDate);
      const attempts: any[] = overdueIndex >= 0 ? (intentsByKey.get(`${plan.id}-${overdueIndex}`) ?? []) : [];
      attempts.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const hasCardOrBank = Boolean(plan.stored_card_token || plan.stored_bank_account_id);

      let error: string | null = null;
      if (!hasCardOrBank) {
        error = 'No card on file';
      } else if (attempts.length > 0) {
        const lastFailed = attempts.find((a) => FAILED_STATUSES.has(a.status));
        error = lastFailed?.failure_reason ?? (lastFailed ? 'Payment attempt failed' : null);
      }

      late.push({
        memberId: m.id,
        name,
        amount: s.overdueAmount ?? 0,
        date: s.overdueSinceDate ?? today,
        attempts: attempts.length,
        lastAttemptDate: attempts[0]?.created_at ?? null,
        error,
      });
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  late.sort((a, b) => a.date.localeCompare(b.date));

  const recent: RecentRow[] = ((recentRes.data ?? []) as any[]).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    category: p.category,
    name: p.family_members ? `${p.family_members.first_name} ${p.family_members.last_name}` : '',
    paidAt: p.paid_at,
  }));
  const recentTotalCount = recentCountRes.count ?? recent.length;

  let batches: BatchRow[] = [];
  if (billingActive) {
    try {
      const [cardBatches, achBatches] = await Promise.all([
        listCardBatchesWithAmounts(),
        listAchBatchesWithAmounts(),
      ]);
      const summaries = [...cardBatches, ...achBatches].sort((a, b) =>
        (b.dateClosed ?? '').localeCompare(a.dateClosed ?? ''),
      );

      // Helcim only knows our invoice number (payment_intents.reference) and,
      // for cards, the cardholder's name — neither of which is the dancer the
      // money is for. Resolve references to dancer names so a deposit can be
      // traced without cross-checking Helcim by hand.
      const references = summaries
        .flatMap((b) => b.items.map((i) => i.invoiceNumber))
        .filter((r): r is string => Boolean(r));
      const nameByReference = new Map<string, string>();
      if (references.length > 0) {
        const { data: refRows } = await supabase
          .from('payment_intents')
          .select('reference, family_members(first_name, last_name)')
          .in('reference', Array.from(new Set(references)));
        for (const row of (refRows ?? []) as any[]) {
          if (row.family_members) {
            nameByReference.set(
              row.reference,
              `${row.family_members.first_name} ${row.family_members.last_name}`,
            );
          }
        }
      }

      batches = summaries.map((b) => ({
        ...b,
        items: b.items.map((i) => ({
          ...i,
          dancerName: i.invoiceNumber ? (nameByReference.get(i.invoiceNumber) ?? null) : null,
        })),
      }));
    } catch (err) {
      // Non-fatal — the rest of the page (late/recent/upcoming) still works
      // even if Helcim's batch endpoints are briefly unavailable. Log it
      // though: silently swallowing left an empty "Bank deposits" tab looking
      // like "no deposits yet" with no way to tell the difference.
      console.error('Bank deposits: could not load Helcim batches —', (err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-pink">Payments</h1>

      {!billingActive && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Online collection activates once Helcim is connected. Until then these are the scheduled
          amounts; “late” and retry dates populate once payments are being recorded.
        </p>
      )}

      <PaymentsTabs
        late={late}
        recent={recent}
        recentTotalCount={recentTotalCount}
        upcoming={upcoming}
        batches={batches}
      />

      {/* CSV export */}
      <section className="space-y-3 rounded-lg border border-brand-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-pink">Export for taxes (CSV)</h2>
        <p className="text-sm text-brand-ink/70">
          Download all recorded payments in a date range. Leave dates blank for everything.
        </p>
        <form action="/api/admin/payments/export" method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="from" className="block text-sm font-medium text-brand-ink">
              From
            </label>
            <input id="from" name="from" type="date" className={inputClass} />
          </div>
          <div>
            <label htmlFor="to" className="block text-sm font-medium text-brand-ink">
              To
            </label>
            <input id="to" name="to" type="date" className={inputClass} />
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand-pink px-4 py-2 font-semibold text-white hover:bg-brand-pinkdark"
          >
            Download CSV
          </button>
        </form>
      </section>
    </div>
  );
}
