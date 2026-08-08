/** Month-grid math for the dashboard calendar. Everything is UTC-based and
 *  operates on 'YYYY-MM' / 'YYYY-MM-DD' strings to stay timezone-safe. */

const DAY_MS = 86_400_000;

export interface DayCell {
  iso: string; // YYYY-MM-DD
  day: number; // 1..31
  inMonth: boolean;
}

export interface YearMonth {
  year: number;
  month: number; // 1..12
}

export function parseYm(ym: string | undefined, fallback: YearMonth): YearMonth {
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [year, month] = ym.split('-').map(Number);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return fallback;
}

export function toYm({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function ymFromIso(iso: string): YearMonth {
  const [year, month] = iso.split('-').map(Number);
  return { year, month };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const zero = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

/** First and last calendar day of the month, inclusive, as ISO strings. */
export function monthBounds({ year, month }: YearMonth): { first: string; last: string } {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return { first: first.toISOString().slice(0, 10), last: last.toISOString().slice(0, 10) };
}

export function monthLabel({ year, month }: YearMonth): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** A fixed 6-week grid (Sunday-first) covering the month. */
export function monthMatrix({ year, month }: YearMonth): DayCell[][] {
  const firstOfMonth = Date.UTC(year, month - 1, 1);
  const startDow = new Date(firstOfMonth).getUTCDay(); // 0 = Sunday
  const gridStart = firstOfMonth - startDow * DAY_MS;

  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(gridStart + (w * 7 + d) * DAY_MS);
      week.push({
        iso: dt.toISOString().slice(0, 10),
        day: dt.getUTCDate(),
        inMonth: dt.getUTCMonth() === month - 1,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
