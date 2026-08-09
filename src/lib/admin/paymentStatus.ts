/**
 * Summarize a dancer's payment standing from their active plan + recorded
 * payments. "Overdue" only applies once billing is actually active (Helcim
 * connected) — before that, nothing is being collected, so a past-due
 * installment isn't really late.
 */

export type PayStatus = 'no_plan' | 'paid' | 'overdue' | 'on_track';

export interface Installment {
  date: string;
  amount: number;
}

export interface DancerPaymentSummary {
  status: PayStatus;
  label: string;
  nextPaymentDate: string | null;
  nextPaymentAmount: number | null;
  total: number;
  paid: number;
}

export function summarizePayments(
  plan: { total_amount: number; installment_schedule: unknown; status: string } | null,
  payments: { amount: number; paid_at: string | null }[],
  todayIso: string,
  billingActive: boolean,
): DancerPaymentSummary {
  if (!plan) {
    return {
      status: 'no_plan',
      label: 'No plan',
      nextPaymentDate: null,
      nextPaymentAmount: null,
      total: 0,
      paid: 0,
    };
  }

  const schedule: Installment[] = Array.isArray(plan.installment_schedule)
    ? (plan.installment_schedule as Installment[])
    : [];
  const total = Number(plan.total_amount);
  const paid = payments
    .filter((p) => p.paid_at)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const upcoming = [...schedule]
    .filter((i) => i.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0] ?? null;

  if (plan.status === 'completed' || (total > 0 && paid >= total)) {
    return { status: 'paid', label: 'Paid in full', nextPaymentDate: null, nextPaymentAmount: null, total, paid };
  }

  const dueSoFar = schedule
    .filter((i) => i.date <= todayIso)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  if (billingActive && paid + 0.001 < dueSoFar) {
    return {
      status: 'overdue',
      label: 'Payment overdue',
      nextPaymentDate: next?.date ?? null,
      nextPaymentAmount: next?.amount ?? null,
      total,
      paid,
    };
  }

  return {
    status: 'on_track',
    label: next ? 'On track' : 'Scheduled',
    nextPaymentDate: next?.date ?? null,
    nextPaymentAmount: next?.amount ?? null,
    total,
    paid,
  };
}
