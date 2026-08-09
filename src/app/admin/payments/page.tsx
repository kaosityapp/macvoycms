import { createClient } from '@/lib/supabase/server';
import { isHelcimConfigured } from '@/lib/integrations/helcim';
import { summarizePayments } from '@/lib/admin/paymentStatus';
import { todayIso } from '@/lib/billing/dueDates';
import { money, formatTimestamp, formatDateShort } from '@/lib/format';
import { inputClass } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const today = todayIso();
  const billingActive = isHelcimConfigured();

  const [dancersRes, recentRes] = await Promise.all([
    supabase
      .from('family_members')
      .select(
        'id, first_name, last_name, payment_plans(total_amount, installment_schedule, status), payments(amount, paid_at)',
      )
      .eq('status', 'active'),
    supabase
      .from('payments')
      .select('id, amount, category, paid_at, family_members(first_name, last_name)')
      .order('paid_at', { ascending: false, nullsFirst: false })
      .limit(25),
  ]);

  const upcoming: { name: string; date: string; amount: number }[] = [];
  const late: { name: string; amount: number; date: string }[] = [];
  for (const m of (dancersRes.data ?? []) as any[]) {
    const plan = (m.payment_plans ?? []).find((p: any) => p.status === 'active') ?? null;
    if (!plan) continue;
    const name = `${m.first_name} ${m.last_name}`;
    const schedule = Array.isArray(plan.installment_schedule) ? plan.installment_schedule : [];
    for (const inst of schedule) {
      if (inst?.date && inst.date >= today) upcoming.push({ name, date: inst.date, amount: Number(inst.amount) });
    }
    const s = summarizePayments(plan, m.payments ?? [], today, billingActive);
    if (s.status === 'overdue') late.push({ name, amount: s.total - s.paid, date: s.nextPaymentDate ?? today });
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  const upcomingTotal = upcoming.reduce((sum, u) => sum + u.amount, 0);
  const payments = (recentRes.data ?? []) as any[];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-pink">Payments</h1>

      {!billingActive && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Online collection activates once Helcim is connected. Until then these are the scheduled
          amounts; “late” and retry dates populate once payments are being recorded.
        </p>
      )}

      {/* Upcoming payments */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-brand-pink">Upcoming payments</h2>
          <span className="text-sm text-brand-ink/60">Total: {money(upcomingTotal)}</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-brand-ink/10 bg-white">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-brand-ink/50">
                <th className="px-5 py-2 font-medium">Dancer</th>
                <th className="px-5 py-2 font-medium">Due date</th>
                <th className="px-5 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {upcoming.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-4 text-brand-ink/60">
                    Nothing scheduled.
                  </td>
                </tr>
              )}
              {upcoming.map((u, i) => (
                <tr key={i}>
                  <td className="px-5 py-2 text-brand-ink">{u.name}</td>
                  <td className="px-5 py-2 text-brand-ink/70">{formatDateShort(u.date)}</td>
                  <td className="px-5 py-2 text-brand-ink/70">{money(u.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Late payments */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Late payments</h2>
        <div className="overflow-x-auto rounded-lg border border-brand-ink/10 bg-white">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-brand-ink/50">
                <th className="px-5 py-2 font-medium">Dancer</th>
                <th className="px-5 py-2 font-medium">Amount owed</th>
                <th className="px-5 py-2 font-medium">Due date</th>
                <th className="px-5 py-2 font-medium">Next attempt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {late.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-4 text-brand-ink/60">
                    No late payments.
                  </td>
                </tr>
              )}
              {late.map((l, i) => (
                <tr key={i}>
                  <td className="px-5 py-2 text-brand-ink">{l.name}</td>
                  <td className="px-5 py-2 font-medium text-red-700">{money(l.amount)}</td>
                  <td className="px-5 py-2 text-brand-ink/70">{formatDateShort(l.date)}</td>
                  <td className="px-5 py-2 text-brand-ink/50">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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

      {/* Recent recorded payments */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Recent payments</h2>
        <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <span className="font-medium text-brand-ink">{money(p.amount)}</span>{' '}
                <span className="capitalize text-brand-ink/60">· {p.category}</span>{' '}
                <span className="text-brand-ink/60">
                  ·{' '}
                  {p.family_members
                    ? `${p.family_members.first_name} ${p.family_members.last_name}`
                    : ''}
                </span>
              </div>
              <span className="text-brand-ink/50">{p.paid_at ? formatTimestamp(p.paid_at) : ''}</span>
            </li>
          ))}
          {payments.length === 0 && (
            <li className="px-5 py-6 text-brand-ink/60">No payments recorded yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
