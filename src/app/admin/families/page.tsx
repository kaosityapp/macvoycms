import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isHelcimConfigured } from '@/lib/integrations/helcim';
import { summarizePayments, type PayStatus } from '@/lib/admin/paymentStatus';
import { todayIso } from '@/lib/billing/dueDates';
import { money, formatDateShort } from '@/lib/format';

export const dynamic = 'force-dynamic';

const BADGE: Record<PayStatus, string> = {
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-700',
  on_track: 'bg-brand-pink/10 text-brand-pink',
  no_plan: 'bg-brand-ink/10 text-brand-ink/60',
};

type Status = 'pending' | 'confirmed' | 'cancelled';

const STATUS_BADGE: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-brand-ink/10 text-brand-ink/60',
};
const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

interface PendingDancer {
  first_name: string;
  last_name: string;
  total_amount?: number;
  payments_received?: { amount: number }[];
}

export default async function DancersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const today = todayIso();
  const billingActive = isHelcimConfigured();

  const [confirmedRes, pendingRes] = await Promise.all([
    supabase
      .from('family_members')
      .select(
        `id, first_name, last_name, status,
         family:family_accounts(parent1_email),
         payment_plans(total_amount, installment_schedule, status),
         payments(amount, paid_at)`,
      )
      .order('last_name', { ascending: true }),
    admin
      .from('pending_registrations')
      .select('id, email, dancers')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  const confirmedRows = ((confirmedRes.data ?? []) as any[]).map((m) => {
    const plan = (m.payment_plans ?? []).find((p: any) => p.status === 'active') ?? null;
    const summary = summarizePayments(plan, m.payments ?? [], today, billingActive);
    const status: Status = m.status === 'removed' ? 'cancelled' : 'confirmed';
    return {
      key: `c-${m.id}`,
      href: `/admin/families/${m.id}`,
      name: `${m.first_name} ${m.last_name}`,
      email: m.family?.parent1_email ?? '',
      status,
      paymentLabel: summary.label,
      paymentBadge: BADGE[summary.status],
      nextPayment:
        summary.nextPaymentDate
          ? `${formatDateShort(summary.nextPaymentDate)}${
              summary.nextPaymentAmount != null ? ` · ${money(summary.nextPaymentAmount)}` : ''
            }`
          : '—',
    };
  });

  const pendingRows = ((pendingRes.data ?? []) as any[]).flatMap((p) =>
    ((p.dancers ?? []) as PendingDancer[]).map((d, i) => {
      const received = (d.payments_received ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
      let paymentLabel = 'No plan set';
      let paymentBadge = 'bg-brand-ink/10 text-brand-ink/60';
      if (received > 0) {
        paymentLabel = `Partial · ${money(received)} of ${money(d.total_amount ?? 0)}`;
        paymentBadge = 'bg-amber-100 text-amber-800';
      } else if (d.total_amount) {
        paymentLabel = `Plan set · ${money(d.total_amount)}`;
        paymentBadge = 'bg-brand-pink/10 text-brand-pink';
      }
      return {
        key: `p-${p.id}-${i}`,
        href: `/admin/pending/${p.id}`,
        name: `${d.first_name} ${d.last_name}`,
        email: p.email,
        status: 'pending' as Status,
        paymentLabel,
        paymentBadge,
        nextPayment: '—',
      };
    }),
  );

  const allRows = [...confirmedRows, ...pendingRows].sort((a, b) => a.name.localeCompare(b.name));
  const activeFilter: Status | 'all' =
    statusFilter === 'pending' || statusFilter === 'confirmed' || statusFilter === 'cancelled'
      ? statusFilter
      : 'all';
  const rows = activeFilter === 'all' ? allRows : allRows.filter((r) => r.status === activeFilter);

  const counts = {
    all: allRows.length,
    pending: allRows.filter((r) => r.status === 'pending').length,
    confirmed: allRows.filter((r) => r.status === 'confirmed').length,
    cancelled: allRows.filter((r) => r.status === 'cancelled').length,
  };

  const TABS: { value: Status | 'all'; label: string }[] = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'pending', label: `Pending (${counts.pending})` },
    { value: 'confirmed', label: `Confirmed (${counts.confirmed})` },
    { value: 'cancelled', label: `Cancelled (${counts.cancelled})` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-pink">Dancers</h1>

      <nav className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === 'all' ? '/admin/families' : `/admin/families?status=${tab.value}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeFilter === tab.value
                ? 'bg-brand-pink text-white'
                : 'text-brand-ink/70 hover:bg-brand-pink/10 hover:text-brand-ink'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/60">
          No dancers in this view.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-ink/10 bg-white">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-brand-ink/50">
                <th className="px-5 py-3 font-medium">Dancer</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Payment status</th>
                <th className="px-5 py-3 font-medium">Next payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {rows.map((r) => (
                <tr key={r.key} className={`hover:bg-brand-pink/5 ${r.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3">
                    <Link href={r.href} className="font-medium text-brand-pink hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-brand-ink/70">{r.email}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.paymentBadge}`}>
                      {r.paymentLabel}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-brand-ink/70">{r.nextPayment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-brand-ink/50">
        <strong>Pending</strong> = imported from the spreadsheet but not yet confirmed by the family
        — click through to edit their details, classes, or payment plan. <strong>Confirmed</strong> =
        registration complete. <strong>Cancelled</strong> = the school cancelled this dancer — their
        record, payment history, and waivers are kept, only future billing and their class spot are
        removed.
        {!billingActive &&
          ' Payment status reflects the schedule; "overdue" activates once Helcim is connected and payments are recorded.'}
      </p>
    </div>
  );
}
