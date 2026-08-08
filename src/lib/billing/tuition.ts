/**
 * Tuition & payment-plan math (spec §3.3, §9).
 *
 * Rules encoded here:
 *   - Tuition per dancer = sum of rate_card price for each active enrollment's
 *     class duration. Combined multi-class schedules are a literal sum — no
 *     combo discount.
 *   - Default plans: quarterly (4 installments) or pay-in-full.
 *
 * Pure functions — no DB access — so they're trivially testable. Callers pass
 * in the rate map (duration_minutes → price) loaded from `rate_card`.
 */

export type RateMap = Map<number, number>;

export interface EnrollmentForPricing {
  classId: string;
  durationMinutes: number;
}

export interface TuitionLine {
  classId: string;
  durationMinutes: number;
  price: number;
  /** True when no rate_card row matched this duration (e.g. a 45-min class). */
  unpriced: boolean;
}

export interface TuitionResult {
  lines: TuitionLine[];
  total: number;
  hasUnpricedLines: boolean;
}

/** Sum rate-card lookups across a dancer's active enrollments. */
export function computeTuition(
  enrollments: EnrollmentForPricing[],
  rates: RateMap,
): TuitionResult {
  const lines: TuitionLine[] = enrollments.map((e) => {
    const price = rates.get(e.durationMinutes);
    return {
      classId: e.classId,
      durationMinutes: e.durationMinutes,
      price: price ?? 0,
      unpriced: price === undefined,
    };
  });

  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.price, 0),
    hasUnpricedLines: lines.some((l) => l.unpriced),
  };
}

export interface InstallmentItem {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  amount: number;
}

/**
 * Build a 4-installment quarterly schedule. Splits `total` into 4 parts,
 * pushing any rounding remainder into the first installment so the sum is
 * exact to the cent. `dueDates` must be 4 ISO dates.
 */
export function quarterlySchedule(total: number, dueDates: string[]): InstallmentItem[] {
  if (dueDates.length !== 4) {
    throw new Error('quarterlySchedule expects exactly 4 due dates.');
  }
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / 4);
  const remainder = cents - base * 4;

  return dueDates.map((date, i) => ({
    date,
    amount: (base + (i === 0 ? remainder : 0)) / 100,
  }));
}

/** Pay-in-full "schedule": a single installment on the given date. */
export function paidInFullSchedule(total: number, dueDate: string): InstallmentItem[] {
  return [{ date: dueDate, amount: total }];
}
