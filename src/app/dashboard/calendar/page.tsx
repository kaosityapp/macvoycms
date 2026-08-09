import Link from 'next/link';
import { getFamilyAccount } from '@/lib/auth';
import { getActiveEnrollments, getNextSession, getSessionsInRange } from '@/lib/dashboard';
import { todayIso } from '@/lib/billing/dueDates';
import { formatTime } from '@/lib/format';
import {
  addMonths,
  monthBounds,
  monthLabel,
  monthMatrix,
  parseYm,
  toYm,
  ymFromIso,
  WEEKDAY_LABELS,
} from '@/lib/calendar';
import { DancerFilter } from './DancerFilter';

export const dynamic = 'force-dynamic';

// Distinct per-dancer colors. Deliberately avoids red (reserved for
// "cancelled") and the brand pink (reserved for UI accents/today).
const DANCER_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#059669', // emerald
  '#4f46e5', // indigo
  '#ca8a04', // dark yellow
];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; dancers?: string }>;
}) {
  const params = await searchParams;
  const account = await getFamilyAccount();
  if (!account) {
    return <p className="text-brand-ink/70">No family account found.</p>;
  }

  const today = todayIso();
  const enrollments = await getActiveEnrollments(account.id);

  // Distinct dancers, each assigned a stable color by first-name order.
  const dancers = [...new Map(enrollments.map((e) => [e.memberId, e.memberFirstName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d, i) => ({ ...d, color: DANCER_COLORS[i % DANCER_COLORS.length] }));
  const colorByMemberId = new Map(dancers.map((d) => [d.id, d.color]));

  const requestedIds = (params.dancers ?? '').split(',').filter(Boolean);
  const validRequested = requestedIds.filter((id) => dancers.some((d) => d.id === id));
  const selected = new Set(validRequested.length > 0 ? validRequested : dancers.map((d) => d.id));

  const scopedEnrollments = enrollments.filter((e) => selected.has(e.memberId));
  const classIds = [...new Set(scopedEnrollments.map((e) => e.classId))];

  // classId → dancers (id/name/color) enrolled, among the currently selected.
  const dancersByClass = new Map<string, { id: string; name: string; color: string }[]>();
  for (const e of scopedEnrollments) {
    if (!dancersByClass.has(e.classId)) dancersByClass.set(e.classId, []);
    const list = dancersByClass.get(e.classId)!;
    if (!list.some((d) => d.id === e.memberId)) {
      list.push({ id: e.memberId, name: e.memberFirstName, color: colorByMemberId.get(e.memberId) ?? '#6b7280' });
    }
  }

  // Default to the month of the next upcoming session.
  let ym = parseYm(params.month, ymFromIso(today));
  if (!params.month) {
    const next = await getNextSession(classIds, today);
    if (next) ym = ymFromIso(next.sessionDate);
  }

  const { first, last } = monthBounds(ym);
  const sessions = await getSessionsInRange(classIds, first, last);

  const byDate = new Map<string, typeof sessions>();
  for (const s of sessions) {
    if (!byDate.has(s.sessionDate)) byDate.set(s.sessionDate, []);
    byDate.get(s.sessionDate)!.push(s);
  }

  const weeks = monthMatrix(ym);
  const prev = toYm(addMonths(ym, -1));
  const next = toYm(addMonths(ym, 1));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-pink">Calendar</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/calendar?month=${prev}${params.dancers ? `&dancers=${params.dancers}` : ''}`}
            className="rounded-md border border-brand-ink/15 px-3 py-1.5 text-sm hover:bg-brand-pink/5"
            aria-label="Previous month"
          >
            ←
          </Link>
          <span className="min-w-[10rem] text-center font-semibold text-brand-ink">
            {monthLabel(ym)}
          </span>
          <Link
            href={`/dashboard/calendar?month=${next}${params.dancers ? `&dancers=${params.dancers}` : ''}`}
            className="rounded-md border border-brand-ink/15 px-3 py-1.5 text-sm hover:bg-brand-pink/5"
            aria-label="Next month"
          >
            →
          </Link>
        </div>
      </div>

      {/* Dancer filter (multi-select) */}
      {dancers.length > 1 && <DancerFilter dancers={dancers} selected={selected} month={toYm(ym)} />}

      {classIds.length === 0 ? (
        <p className="rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/70">
          No active class enrollments to show.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[42rem] rounded-lg border border-brand-ink/10 bg-white">
            <div className="grid grid-cols-7 border-b border-brand-ink/10 text-center text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {weeks.flat().map((cell) => {
                const daySessions = byDate.get(cell.iso) ?? [];
                const isToday = cell.iso === today;
                return (
                  <div
                    key={cell.iso}
                    className={`min-h-[6rem] border-b border-r border-brand-ink/10 p-1.5 ${
                      cell.inMonth ? '' : 'bg-brand-ink/[0.02]'
                    }`}
                  >
                    <div
                      className={`mb-1 text-right text-xs ${
                        cell.inMonth ? 'text-brand-ink/60' : 'text-brand-ink/25'
                      }`}
                    >
                      <span
                        className={
                          isToday
                            ? 'inline-block rounded-full bg-brand-pink px-1.5 text-white'
                            : undefined
                        }
                      >
                        {cell.day}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {daySessions.map((s) => {
                        const cancelled = s.status === 'cancelled';
                        const dancersHere = dancersByClass.get(s.classId) ?? [];
                        const soleColor = dancersHere.length === 1 ? dancersHere[0].color : null;
                        return (
                          <div
                            key={s.id}
                            className={`rounded px-1.5 py-1 text-[11px] leading-tight ${
                              cancelled ? 'bg-red-50' : !soleColor ? 'bg-brand-ink/5' : ''
                            }`}
                            style={
                              !cancelled && soleColor
                                ? { backgroundColor: `${soleColor}1a`, borderLeft: `3px solid ${soleColor}` }
                                : !cancelled && dancersHere.length > 1
                                  ? { borderLeft: '3px solid #9ca3af' }
                                  : undefined
                            }
                          >
                            <div
                              className={`font-medium ${
                                cancelled ? 'text-red-400 line-through' : 'text-brand-ink'
                              }`}
                            >
                              {s.className}
                            </div>
                            <div
                              className={cancelled ? 'text-red-400/70 line-through' : 'text-brand-ink/60'}
                            >
                              {formatTime(s.startTime)}
                            </div>
                            {cancelled && s.note && (
                              <div className="mt-0.5 font-medium text-red-600">{s.note}</div>
                            )}
                            {!cancelled && dancersHere.length > 1 && (
                              <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
                                {dancersHere.map((dh) => (
                                  <span key={dh.id} className="flex items-center gap-1">
                                    <span
                                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: dh.color }}
                                    />
                                    <span className="text-brand-ink/70">{dh.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-brand-ink/50">
        Cancelled classes appear struck through. The calendar updates automatically when the
        school changes the schedule.
      </p>
    </div>
  );
}
