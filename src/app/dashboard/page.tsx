import Link from 'next/link';
import { getFamilyAccount, isAdmin } from '@/lib/auth';
import {
  getActiveEnrollments,
  getSessionsInRange,
  getUpcomingInstallments,
  getAnnouncements,
  getReadAnnouncementIds,
} from '@/lib/dashboard';
import { todayIso, addDays } from '@/lib/billing/dueDates';
import { money, formatDateLong, formatTime, formatDateShort, formatTimestamp } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;
  const account = await getFamilyAccount();
  const admin = await isAdmin();

  if (!account) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-brand-pink">Welcome</h1>
        <p className="mt-4 text-brand-ink/70">
          {admin
            ? 'You are signed in as an administrator.'
            : "Your login isn't linked to a family account yet."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {admin && (
            <Link
              href="/admin"
              className="rounded-md bg-brand-pink px-4 py-2 font-semibold text-white hover:bg-brand-pinkdark"
            >
              Go to Admin
            </Link>
          )}
          <Link href="/register" className="text-brand-pink hover:underline">
            Register a dancer →
          </Link>
        </div>
      </div>
    );
  }

  const today = todayIso();
  const in7Days = addDays(today, 7);
  const in30Days = addDays(today, 30);

  const [enrollments, upcoming, announcements, readIds] = await Promise.all([
    getActiveEnrollments(account.id),
    getUpcomingInstallments(account.id, today),
    getAnnouncements(),
    getReadAnnouncementIds(account.id),
  ]);

  const classIds = [...new Set(enrollments.map((e) => e.classId))];
  const upcomingClasses = await getSessionsInRange(classIds, today, in7Days);
  const upcomingPayments = upcoming.filter((i) => i.date <= in30Days);

  // classId → dancer first names, for labelling the 7-day class list.
  const dancersByClass = new Map<string, string[]>();
  for (const e of enrollments) {
    if (!dancersByClass.has(e.classId)) dancersByClass.set(e.classId, []);
    const list = dancersByClass.get(e.classId)!;
    if (!list.includes(e.memberFirstName)) list.push(e.memberFirstName);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-pink">
          Hello, {account.parent1_name.split(' ')[0]}
        </h1>
      </div>

      {registered && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Registration complete! Find the new dancer under Profile.
        </div>
      )}

      {/* Announcements — last 30 days */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Announcements</h2>
        <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {announcements.length === 0 && (
            <p className="px-5 py-4 text-sm text-brand-ink/60">
              No announcements in the last 30 days.
            </p>
          )}
          {announcements.map((a) => {
            const unread = !readIds.has(a.id);
            return (
              <Link
                key={a.id}
                href={`/dashboard/announcements/${a.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-brand-pink/5"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-brand-ink">{a.subject}</span>
                    {unread && (
                      <span className="animate-pulse rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        New!
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-brand-ink/50">
                    {a.sent_at ? formatTimestamp(a.sent_at) : ''}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Next Class — everyone on the account, next 7 days */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Next Class</h2>
        <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {upcomingClasses.length === 0 && (
            <p className="px-5 py-4 text-sm text-brand-ink/60">No classes in the next 7 days.</p>
          )}
          {upcomingClasses.map((s) => {
            const cancelled = s.status === 'cancelled';
            const names = dancersByClass.get(s.classId) ?? [];
            return (
              <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <div className={`font-medium ${cancelled ? 'text-red-400 line-through' : 'text-brand-ink'}`}>
                    {s.className}
                    {names.length > 0 && <span className="text-brand-pink"> · {names.join(', ')}</span>}
                  </div>
                  {cancelled && s.note && (
                    <div className="text-xs font-medium text-red-600">{s.note}</div>
                  )}
                </div>
                <div className={`text-right text-sm ${cancelled ? 'text-red-400/70 line-through' : 'text-brand-ink/60'}`}>
                  {formatDateLong(s.sessionDate)}
                  <br />
                  {formatTime(s.startTime)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Next Payment — due within 30 days, amount and date only */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Next Payment</h2>
        <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {upcomingPayments.length === 0 ? (
            <p className="px-5 py-4 text-sm text-brand-ink/60">
              No Pending Payments within the next 30 days.
            </p>
          ) : (
            upcomingPayments.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium text-brand-ink">{money(p.amount)}</span>
                <span className="text-brand-ink/60">{formatDateShort(p.date)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {admin && (
        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin"
            className="rounded-md border border-brand-pink px-4 py-2 font-semibold text-brand-pink"
          >
            Admin
          </Link>
        </div>
      )}
    </div>
  );
}
