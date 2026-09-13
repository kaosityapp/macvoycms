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
  /** Only set when status is 'overdue': the amount past due (not the whole remaining balance). */
  overdueAmount: number | null;
  /** Only set when status is 'overdue': the earliest unpaid installment's due date (not the next upcoming one). */
  overdueSinceDate: string | null;
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
      overdueAmount: null,
      overdueSinceDate: null,
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

  const sortedSchedule = [...schedule].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sortedSchedule.filter((i) => i.date >= todayIso);
  const next = upcoming[0] ?? null;

  if (plan.status === 'completed' || (total > 0 && paid >= total)) {
    return {
      status: 'paid',
      label: 'Paid in full',
      nextPaymentDate: null,
      nextPaymentAmount: null,
      overdueAmount: null,
      overdueSinceDate: null,
      total,
      paid,
    };
  }

  const dueSoFar = sortedSchedule
    .filter((i) => i.date <= todayIso)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  if (billingActive && paid + 0.001 < dueSoFar) {
    // The earliest installment that's both past due and not yet covered by
    // cumulative payments — NOT the next upcoming one (which may be weeks
    // away and hasn't come due yet).
    let cumulative = 0;
    let overdueSinceDate: string | null = null;
    for (const inst of sortedSchedule) {
      cumulative += Number(inst.amount);
      if (inst.date <= todayIso && paid + 0.001 < cumulative) {
        overdueSinceDate = inst.date;
        break;
      }
    }
    return {
      status: 'overdue',
      label: 'Payment overdue',
      nextPaymentDate: next?.date ?? null,
      nextPaymentAmount: next?.amount ?? null,
      overdueAmount: dueSoFar - paid,
      overdueSinceDate,
      total,
      paid,
    };
  }

  return {
    status: 'on_track',
    label: next ? 'Payment up to date' : 'Scheduled',
    nextPaymentDate: next?.date ?? null,
    nextPaymentAmount: next?.amount ?? null,
    overdueAmount: null,
    overdueSinceDate: null,
    total,
    paid,
  };
}
