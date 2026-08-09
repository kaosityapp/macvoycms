/**
 * Default installment due dates. These are sensible defaults generated at
 * registration; Debbie can override any schedule with a custom plan in admin.
 */

/** Add `n` months to an ISO date (YYYY-MM-DD), clamping the day to month end. */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, lastDay));
  return base.toISOString().slice(0, 10);
}

/** Four quarterly due dates starting at `fromIso` (0, +3, +6, +9 months). */
export function defaultQuarterlyDueDates(fromIso: string): string[] {
  return [0, 3, 6, 9].map((n) => addMonths(fromIso, n));
}

/** Today as an ISO date string (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Add `n` days to an ISO date (YYYY-MM-DD). */
export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
