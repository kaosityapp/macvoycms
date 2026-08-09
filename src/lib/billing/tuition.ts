/**
 * Tuition & payment-plan math (spec §3.3, §9).
 *
 * Pricing model (per Debbie): tuition for a class =
 *   hourly_rate × (duration_minutes ÷ 60) × total_sessions
 * summed across a dancer's active enrollments. No combo discount.
 *
 * Pure functions — no DB access — so they're trivially testable.
 */

export interface EnrollmentForPricing {
  classId: string;
  hourlyRate: number | null;
  durationMinutes: number;
  totalSessions: number | null;
}

export interface TuitionLine {
  classId: string;
  price: number;
  /** True when hourly_rate or total_sessions isn't set yet on the class. */
  unpriced: boolean;
}

export interface TuitionResult {
  lines: TuitionLine[];
  total: number;
  hasUnpricedLines: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Price a single class: hourly_rate × hours × sessions. */
export function classTuition(
  hourlyRate: number | null,
  durationMinutes: number,
  totalSessions: number | null,
): number | null {
  if (hourlyRate == null || totalSessions == null) return null;
  return round2(hourlyRate * (durationMinutes / 60) * totalSessions);
}

/** Sum tuition across a dancer's active enrollments. */
export function computeTuition(enrollments: EnrollmentForPricing[]): TuitionResult {
  const lines: TuitionLine[] = enrollments.map((e) => {
    const price = classTuition(e.hourlyRate, e.durationMinutes, e.totalSessions);
    return { classId: e.classId, price: price ?? 0, unpriced: price === null };
  });

  return {
    lines,
    total: round2(lines.reduce((sum, l) => sum + l.price, 0)),
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
