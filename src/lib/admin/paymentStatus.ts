/**
 * Summarize a dancer's payment standing from their active plan + recorded
 * payments. "Overdue" only applies once billing is actually active (Helcim
 * connected) — before that, nothing is being collected, so a past-due
 * installment isn't really late.
 */

import { allocatePayments, type PaymentRecord } from '@/lib/billing/allocation';

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
  payments: PaymentRecord[],
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

  const total = Number(plan.total_amount);
  const paid = payments
    .filter((p) => p.paid_at)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Per-installment, so a family who paid out of order is read correctly —
  // see src/lib/billing/allocation.ts.
  const installments = allocatePayments(plan.installment_schedule, payments, todayIso);
  const outstanding = installments.filter((i) => !i.settled);
  const next = outstanding.find((i) => i.date >= todayIso) ?? null;
  const pastDue = outstanding.filter((i) => i.date <= todayIso);

  if (plan.status === 'completed' || (installments.length > 0 && outstanding.length === 0)) {
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

  if (billingActive && pastDue.length > 0) {
    return {
      status: 'overdue',
      label: 'Payment overdue',
      nextPaymentDate: next?.date ?? null,
      nextPaymentAmount: next?.amount ?? null,
      // What's actually unpaid and past due — not the whole remaining balance,
      // and no longer polluted by card fees inflating the "paid" total.
      overdueAmount: pastDue.reduce((sum, i) => sum + i.amount, 0),
      overdueSinceDate: pastDue[0].date,
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
