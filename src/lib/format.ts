/** Formatting helpers shared across the dashboard. All date handling is UTC so
 *  a plain 'YYYY-MM-DD' never shifts across a timezone boundary. */

export function money(n: number | string): string {
  return `$${Number(n).toFixed(2)}`;
}

/** '17:30:00' → '5:30 PM' */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}

/** '2026-09-10' → 'Thursday, September 10, 2026' */
export function formatDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** '2026-09-10' → 'Sep 10' */
export function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The window an automatic charge actually lands in, e.g. '2026-09-17' →
 * 'September 17–18, 2026'.
 *
 * The recurring cron runs once a day, so an installment isn't charged the
 * moment it falls due — it's charged on the next run, which is the same day
 * for anything already due by then and the following morning otherwise. A
 * single due date made that look late: a family saw "Due September 17" and
 * a receipt dated the 18th. Only plans the cron will actually charge (card
 * or bank on file, auto-charge on) get the window — someone paying by hand
 * owes it on the date itself.
 */
export function formatChargeWindowLong(iso: string): string {
  const { start, finish, sameMonth, sameYear } = chargeWindow(iso);
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  if (!sameYear) {
    return `${month(start)} ${start.getUTCDate()}, ${start.getUTCFullYear()} – ${month(finish)} ${finish.getUTCDate()}, ${finish.getUTCFullYear()}`;
  }
  return sameMonth
    ? `${month(start)} ${start.getUTCDate()}–${finish.getUTCDate()}, ${finish.getUTCFullYear()}`
    : `${month(start)} ${start.getUTCDate()} – ${month(finish)} ${finish.getUTCDate()}, ${finish.getUTCFullYear()}`;
}

/** Same window, compact: '2026-09-17' → 'Sep 17–18' (or 'Sep 30 – Oct 1'). */
export function formatChargeWindowShort(iso: string): string {
  const { start, finish, sameMonth } = chargeWindow(iso);
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return sameMonth
    ? `${month(start)} ${start.getUTCDate()}–${finish.getUTCDate()}`
    : `${month(start)} ${start.getUTCDate()} – ${month(finish)} ${finish.getUTCDate()}`;
}

function chargeWindow(iso: string) {
  const start = new Date(`${iso}T00:00:00Z`);
  const finish = new Date(start.getTime() + 86_400_000);
  const sameYear = start.getUTCFullYear() === finish.getUTCFullYear();
  return { start, finish, sameYear, sameMonth: sameYear && start.getUTCMonth() === finish.getUTCMonth() };
}

/** ISO timestamp → 'Sep 10, 2026' (Eastern time — see todayIso in dueDates.ts for why). */
export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  });
}

/** ISO timestamp → 'Sep 10' (Eastern time, no year — e.g. "agreed Sep 10"). */
export function formatTimestampShort(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Toronto',
  });
}
