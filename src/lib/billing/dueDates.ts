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

/**
 * Four monthly due dates for the Fall session: the first payment is due the
 * day the family chooses this plan (`fromIso`), and the remaining three fall
 * on the 1st of each following month.
 */
export function defaultMonthlyDueDates(fromIso: string): string[] {
  const [y, m] = fromIso.split('-').map(Number);
  const firstOfMonth = (offset: number): string => {
    const date = new Date(Date.UTC(y, m - 1 + offset, 1));
    return date.toISOString().slice(0, 10);
  };
  return [fromIso, firstOfMonth(1), firstOfMonth(2), firstOfMonth(3)];
}

/**
 * Today as an ISO date string in Eastern time (America/Toronto — handles
 * EST/EDT automatically). The school, its due dates, and its classes are
 * all in Toronto, so "today" for billing/display purposes must be Toronto's
 * today, not the server's UTC today — otherwise an installment can look
 * due, or a waiver can look signed, up to 5 hours before it actually is
 * locally (Vercel's serverless functions run in UTC).
 */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
}

/**
 * A real timestamp's calendar date in Eastern time — for turning e.g.
 * `created_at` into "what day did this happen, locally" instead of
 * `.slice(0, 10)`'s UTC calendar day (same reasoning as todayIso above).
 */
export function toEasternDateIso(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date(ts));
}

/** Add `n` days to an ISO date (YYYY-MM-DD). */
export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
