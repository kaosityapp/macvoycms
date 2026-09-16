/**
 * Which installments a plan's payments have actually settled.
 *
 * Every surface used to answer this by summing all payments and netting the
 * total off the schedule in order, so money landed on the earliest
 * installments whatever the family actually paid. That quietly mis-stated a
 * family who paid out of order: their unpaid first installment vanished from
 * the dashboard while two they'd already paid kept a live Pay Now button, and
 * the admin page, the "overdue" badge and the auto-charge picker each drew a
 * different wrong conclusion from the same numbers.
 *
 * A payment that names its installment now settles that installment. Only
 * payments with no index — manual entries, e-transfers, anything carried
 * forward from Debbie's import — still float to the oldest unsettled one.
 *
 * Note that a card payment's amount includes Helcim's ~3% Fee Saver, so it is
 * always a little larger than the installment. That surplus is a processing
 * fee, not tuition, so it stays on the installment it was charged against and
 * never spills forward to cover the next one.
 */

const EPSILON = 0.005;

export interface ScheduleItem {
  date: string;
  amount: number;
}

export interface PaymentRecord {
  amount: number | string;
  paid_at?: string | null;
  installment_index?: number | null;
  payment_plan_id?: string | null;
}

export interface InstallmentState {
  /** Index into the plan's stored schedule — what payment_intents references. */
  index: number;
  date: string;
  amount: number;
  settled: boolean;
  isOverdue: boolean;
}

function toSchedule(raw: unknown): ScheduleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is ScheduleItem => Boolean(i) && typeof (i as ScheduleItem).date === 'string')
    .map((i) => ({ date: i.date, amount: Number(i.amount ?? 0) }));
}

/**
 * Per-installment state, in due-date order. Schedules aren't always stored in
 * date order (Debbie's import kept her spreadsheet's order), so anything that
 * means "the next one due" has to sort rather than trust the array.
 */
export function allocatePayments(
  rawSchedule: unknown,
  payments: PaymentRecord[],
  todayIso: string,
  /** The plan being allocated. An index only means anything against the plan
   *  it was recorded on — a superseded plan's schedule was a different list,
   *  so its positions don't carry over. Pass this wherever payments from more
   *  than one plan can reach here (the admin pages pass every payment a dancer
   *  has ever made). */
  planId?: string | null,
): InstallmentState[] {
  const schedule = toSchedule(rawSchedule);
  const paid = payments.filter((p) => p.paid_at);

  // What each installment has been paid directly.
  const applied = new Map<number, number>();
  let floating = 0;
  for (const p of paid) {
    const amount = Number(p.amount);
    if (!Number.isFinite(amount)) continue;
    const foreignPlan = Boolean(planId && p.payment_plan_id && p.payment_plan_id !== planId);
    const idx = foreignPlan ? null : p.installment_index;
    if (idx == null || idx < 0 || idx >= schedule.length) floating += amount;
    else applied.set(idx, (applied.get(idx) ?? 0) + amount);
  }

  const states: InstallmentState[] = schedule.map((item, index) => ({
    index,
    date: item.date,
    amount: item.amount,
    settled: (applied.get(index) ?? 0) >= item.amount - EPSILON,
    isOverdue: item.date < todayIso,
  }));

  const byDate = [...states].sort((a, b) => a.date.localeCompare(b.date));

  // Unlabelled money covers the oldest outstanding installment first, and
  // stops at the first one it can't cover — it never skips ahead to clear a
  // smaller later installment.
  for (const state of byDate) {
    if (state.settled) continue;
    const owed = state.amount - (applied.get(state.index) ?? 0);
    if (floating < owed - EPSILON) break;
    floating -= owed;
    state.settled = true;
  }

  return byDate;
}

/** Installments still owing, oldest first. */
export function outstandingInstallments(
  rawSchedule: unknown,
  payments: PaymentRecord[],
  todayIso: string,
  planId?: string | null,
): InstallmentState[] {
  return allocatePayments(rawSchedule, payments, todayIso, planId).filter((i) => !i.settled);
}

/**
 * The installment to charge now: the oldest one that's both due and unpaid.
 * Used by the nightly auto-charge and by the admin's manual retry.
 */
export function findDueInstallment(
  rawSchedule: unknown,
  payments: PaymentRecord[],
  todayIso: string,
  planId?: string | null,
): { index: number; amount: number } | null {
  const due = allocatePayments(rawSchedule, payments, todayIso, planId).find(
    (i) => !i.settled && i.date <= todayIso,
  );
  return due ? { index: due.index, amount: due.amount } : null;
}

/** Total still owing across the schedule. */
export function outstandingTotal(
  rawSchedule: unknown,
  payments: PaymentRecord[],
  todayIso: string,
  planId?: string | null,
): number {
  return outstandingInstallments(rawSchedule, payments, todayIso, planId).reduce(
    (sum, i) => sum + i.amount,
    0,
  );
}
