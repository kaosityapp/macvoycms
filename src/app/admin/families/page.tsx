import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
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

export default async function DancersPage() {
  const supabase = await createClient();
  const today = todayIso();
  const billingActive = isHelcimConfigured();

  const { data: dancers } = await supabase
    .from('family_members')
    .select(
      `id, first_name, last_name, status,
       family:family_accounts(parent1_email),
       payment_plans(total_amount, installment_schedule, status),
       payments(amount, paid_at)`,
    )
    .order('last_name', { ascending: true });

  const rows = ((dancers ?? []) as any[]).map((m) => {
    const plan = (m.payment_plans ?? []).find((p: any) => p.status === 'active') ?? null;
    const summary = summarizePayments(plan, m.payments ?? [], today, billingActive);
    return {
      id: m.id,
      name: `${m.first_name} ${m.last_name}`,
      email: m.family?.parent1_email ?? '',
      status: m.status,
      summary,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-pink">Dancers</h1>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/60">
          No dancers registered yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-ink/10 bg-white">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-left text-brand-ink/50">
                <th className="px-5 py-3 font-medium">Dancer</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Payment status</th>
                <th className="px-5 py-3 font-medium">Next payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {rows.map((r) => (
                <tr key={r.id} className={`hover:bg-brand-pink/5 ${r.status === 'removed' ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/families/${r.id}`} className="font-medium text-brand-pink hover:underline">
                      {r.name}
                    </Link>
                    {r.status === 'removed' && (
                      <span className="ml-2 rounded bg-brand-ink/10 px-1.5 py-0.5 text-xs font-semibold text-brand-ink/50">
                        Removed
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-brand-ink/70">{r.email}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.summary.status]}`}>
                      {r.summary.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-brand-ink/70">
                    {r.summary.nextPaymentDate
                      ? `${formatDateShort(r.summary.nextPaymentDate)}${
                          r.summary.nextPaymentAmount != null ? ` · ${money(r.summary.nextPaymentAmount)}` : ''
                        }`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!billingActive && (
        <p className="text-xs text-brand-ink/50">
          Payment status reflects the schedule; “overdue” activates once Helcim is connected and
          payments are recorded.
        </p>
      )}
    </div>
  );
}
