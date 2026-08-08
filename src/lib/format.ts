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

/** ISO timestamp → 'Sep 10, 2026' */
export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
