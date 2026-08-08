import Link from 'next/link';
import { getFamilyAccount, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import {
  getActiveEnrollments,
  getNextSession,
  getUpcomingInstallments,
  getAnnouncements,
  getReadAnnouncementIds,
} from '@/lib/dashboard';
import { todayIso } from '@/lib/billing/dueDates';
import { money, formatDateLong, formatTime, formatDateShort } from '@/lib/format';

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
          Your login isn&apos;t linked to a family account yet.
          {admin && ' (You are signed in as an admin.)'}
        </p>
        <Link href="/register" className="mt-6 inline-block text-brand-pink hover:underline">
          Register a dancer →
        </Link>
      </div>
    );
  }

  const today = todayIso();
  const supabase = await createClient();

  const [enrollments, upcoming, announcements, readIds, membersRes] = await Promise.all([
    getActiveEnrollments(account.id),
    getUpcomingInstallments(account.id, today),
    getAnnouncements(),
    getReadAnnouncementIds(account.id),
    supabase
      .from('family_members')
      .select('id, first_name, last_name, payment_plans(plan_type, total_amount, status)')
      .eq('family_account_id', account.id)
      .order('created_at', { ascending: true }),
  ]);

  const classIds = [...new Set(enrollments.map((e) => e.classId))];
  const nextSession = await getNextSession(classIds, today);
  const nextInstallment = upcoming[0] ?? null;
  const unreadCount = announcements.filter((a) => !readIds.has(a.id)).length;

  const members = (membersRes.data ?? []) as any[];
  const enrollmentsByMember = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    if (!enrollmentsByMember.has(e.memberId)) enrollmentsByMember.set(e.memberId, []);
    enrollmentsByMember.get(e.memberId)!.push(e);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-pink">
          Hello, {account.parent1_name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-brand-ink/70">Here&apos;s a snapshot of your family account.</p>
      </div>

      {registered && (
        <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          Registration complete! The dancer has been added below.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Next class" href="/dashboard/calendar">
          {nextSession ? (
            <>
              <div className="font-semibold text-brand-ink">{nextSession.className}</div>
              <div className="text-sm text-brand-ink/60">
                {formatDateLong(nextSession.sessionDate)}
                <br />
                {formatTime(nextSession.startTime)}
              </div>
            </>
          ) : (
            <span className="text-sm text-brand-ink/50">No upcoming classes</span>
          )}
        </SummaryCard>

        <SummaryCard label="Next payment" href="/dashboard/payments">
          {nextInstallment ? (
            <>
              <div className="font-semibold text-brand-ink">{money(nextInstallment.amount)}</div>
              <div className="text-sm text-brand-ink/60">
                {formatDateShort(nextInstallment.date)} · {nextInstallment.memberName}
              </div>
            </>
          ) : (
            <span className="text-sm text-brand-ink/50">Nothing scheduled</span>
          )}
        </SummaryCard>

        <SummaryCard label="Announcements" href="/dashboard/announcements">
          <div className="font-semibold text-brand-ink">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </div>
          <div className="text-sm text-brand-ink/60">{announcements.length} total</div>
        </SummaryCard>
      </div>

      {/* Dancers */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-pink">Your dancers</h2>
        {members.length === 0 && <p className="text-brand-ink/70">No dancers registered yet.</p>}
        {members.map((m) => {
          const plan = (m.payment_plans as any[])?.find((p) => p.status === 'active');
          const memberEnrollments = enrollmentsByMember.get(m.id) ?? [];
          return (
            <div key={m.id} className="rounded-lg border border-brand-ink/10 bg-white p-5">
              <h3 className="font-semibold text-brand-ink">
                {m.first_name} {m.last_name}
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-brand-ink/70">
                {memberEnrollments.length === 0 && <li>No active classes.</li>}
                {memberEnrollments.map((e) => (
                  <li key={e.classId}>
                    {e.className} — {e.dayOfWeek} {formatTime(e.startTime)} · {e.locationName}
                  </li>
                ))}
              </ul>
              {plan && (
                <p className="mt-3 text-sm text-brand-ink/60">
                  {plan.plan_type === 'quarterly' ? 'Quarterly (4 installments)' : 'Paid in full'} ·{' '}
                  {money(plan.total_amount)}
                </p>
              )}
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/register"
          className="rounded-md bg-brand-pink px-4 py-2 font-semibold text-white hover:bg-brand-pink/90"
        >
          Register another dancer
        </Link>
        {admin && (
          <Link
            href="/admin"
            className="rounded-md border border-brand-pink px-4 py-2 font-semibold text-brand-pink"
          >
            Admin
          </Link>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-brand-ink/10 bg-white p-4 transition hover:border-brand-pink/40"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-pinkdark">{label}</div>
      <div className="mt-2">{children}</div>
    </Link>
  );
}
