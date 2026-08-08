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

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; dancer?: string }>;
}) {
  const params = await searchParams;
  const account = await getFamilyAccount();
  if (!account) {
    return <p className="text-brand-ink/70">No family account found.</p>;
  }

  const today = todayIso();
  const enrollments = await getActiveEnrollments(account.id);

  // Distinct dancers for the filter row.
  const dancers = [...new Map(enrollments.map((e) => [e.memberId, e.memberFirstName])).entries()].map(
    ([id, name]) => ({ id, name }),
  );

  const validDancer = params.dancer && dancers.some((d) => d.id === params.dancer);
  const selectedDancer = validDancer ? params.dancer! : 'all';

  const scopedEnrollments =
    selectedDancer === 'all'
      ? enrollments
      : enrollments.filter((e) => e.memberId === selectedDancer);
  const classIds = [...new Set(scopedEnrollments.map((e) => e.classId))];

  // classId → dancer first names (for the collective view tags).
  const dancersByClass = new Map<string, string[]>();
  for (const e of scopedEnrollments) {
    if (!dancersByClass.has(e.classId)) dancersByClass.set(e.classId, []);
    const list = dancersByClass.get(e.classId)!;
    if (!list.includes(e.memberFirstName)) list.push(e.memberFirstName);
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
  const dancerQ = selectedDancer === 'all' ? '' : `&dancer=${selectedDancer}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-pink">Calendar</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/calendar?month=${prev}${dancerQ}`}
            className="rounded-md border border-brand-ink/15 px-3 py-1.5 text-sm hover:bg-brand-pink/5"
            aria-label="Previous month"
          >
            ←
          </Link>
          <span className="min-w-[10rem] text-center font-semibold text-brand-ink">
            {monthLabel(ym)}
          </span>
          <Link
            href={`/dashboard/calendar?month=${next}${dancerQ}`}
            className="rounded-md border border-brand-ink/15 px-3 py-1.5 text-sm hover:bg-brand-pink/5"
            aria-label="Next month"
          >
            →
          </Link>
        </div>
      </div>

      {/* Dancer filter */}
      {dancers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <DancerTab label="All dancers" href={`/dashboard/calendar?month=${toYm(ym)}`} active={selectedDancer === 'all'} />
          {dancers.map((d) => (
            <DancerTab
              key={d.id}
              label={d.name}
              href={`/dashboard/calendar?month=${toYm(ym)}&dancer=${d.id}`}
              active={selectedDancer === d.id}
            />
          ))}
        </div>
      )}

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
                        const tags = dancersByClass.get(s.classId) ?? [];
                        return (
                          <div
                            key={s.id}
                            className={`rounded px-1.5 py-1 text-[11px] leading-tight ${
                              cancelled
                                ? 'bg-red-50 text-red-400 line-through'
                                : 'bg-brand-pink/10 text-brand-ink'
                            }`}
                            title={s.note ?? undefined}
                          >
                            <div className="font-medium">{s.className}</div>
                            <div className="text-brand-ink/60">{formatTime(s.startTime)}</div>
                            {selectedDancer === 'all' && tags.length > 0 && (
                              <div className="text-brand-pink">{tags.join(', ')}</div>
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

function DancerTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active
          ? 'bg-brand-pink text-white'
          : 'border border-brand-ink/15 text-brand-ink/70 hover:bg-brand-pink/5'
      }`}
    >
      {label}
    </Link>
  );
}
