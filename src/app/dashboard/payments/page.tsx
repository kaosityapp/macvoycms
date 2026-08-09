import { getFamilyAccount } from '@/lib/auth';
import { getUpcomingInstallments, getReceipts, getAutoChargePlans } from '@/lib/dashboard';
import { isHelcimConfigured } from '@/lib/integrations/helcim';
import { todayIso } from '@/lib/billing/dueDates';
import { money, formatDateLong, formatTimestamp } from '@/lib/format';
import { PayNowButton } from './PayNowButton';
import { AutoChargeSection } from './AutoChargeSection';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const account = await getFamilyAccount();
  if (!account) {
    return <p className="text-brand-ink/70">No family account found.</p>;
  }

  const today = todayIso();
  const [upcoming, receipts, autoChargePlans] = await Promise.all([
    getUpcomingInstallments(account.id, today),
    getReceipts(account.id),
    getAutoChargePlans(account.id),
  ]);
  const canPayOnline = isHelcimConfigured();
  const upcomingTotal = upcoming.reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-pink">Payments</h1>

      {!canPayOnline && (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Online payment isn&apos;t available yet — the school is finishing setup of its payment
          processor. Your scheduled amounts are shown below for reference.
        </div>
      )}

      <AutoChargeSection plans={autoChargePlans} />

      {/* Upcoming */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-brand-pink">Upcoming payments</h2>
          {upcoming.length > 0 && (
            <span className="text-sm text-brand-ink/60">{money(upcomingTotal)} scheduled</span>
          )}
        </div>

        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/70">
            No upcoming payments scheduled.
          </p>
        ) : (
          <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
            {upcoming.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="font-medium text-brand-ink">{money(item.amount)}</div>
                  <div className="text-sm text-brand-ink/60">
                    Due {formatDateLong(item.date)} · {item.memberName} ·{' '}
                    {item.planType === 'quarterly' ? 'Quarterly' : 'Paid in full'}
                  </div>
                </div>
                {canPayOnline ? (
                  <PayNowButton
                    memberId={item.memberId}
                    paymentPlanId={item.planId}
                    installmentIndex={item.installmentIndex}
                    amount={item.amount}
                  />
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white opacity-50"
                    title="Online payment coming soon"
                  >
                    Pay now
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Payment history</h2>
        {receipts.length === 0 ? (
          <p className="rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/70">
            No payments recorded yet. Receipts will appear here after your first payment.
          </p>
        ) : (
          <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="font-medium text-brand-ink">{money(r.amount)}</div>
                  <div className="text-sm text-brand-ink/60 capitalize">
                    {r.category} · {r.memberName}
                  </div>
                </div>
                <div className="text-sm text-brand-ink/60">
                  {r.paidAt ? formatTimestamp(r.paidAt) : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
