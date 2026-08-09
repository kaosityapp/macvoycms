import Link from 'next/link';
import { getFamilyAccount } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getActiveEnrollments } from '@/lib/dashboard';
import { money, formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const account = await getFamilyAccount();
  if (!account) {
    return <p className="text-brand-ink/70">No family account found.</p>;
  }

  const supabase = await createClient();
  const [enrollments, membersRes] = await Promise.all([
    getActiveEnrollments(account.id),
    supabase
      .from('family_members')
      .select('id, first_name, last_name, payment_plans(plan_type, total_amount, status)')
      .eq('family_account_id', account.id)
      .order('created_at', { ascending: true }),
  ]);

  const members = (membersRes.data ?? []) as any[];
  const enrollmentsByMember = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    if (!enrollmentsByMember.has(e.memberId)) enrollmentsByMember.set(e.memberId, []);
    enrollmentsByMember.get(e.memberId)!.push(e);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-pink">Profile</h1>

      <div className="space-y-4">
        {members.length === 0 && <p className="text-brand-ink/70">No dancers registered yet.</p>}
        {members.map((m) => {
          const plan = (m.payment_plans as any[])?.find((p) => p.status === 'active');
          const memberEnrollments = enrollmentsByMember.get(m.id) ?? [];
          return (
            <Link
              key={m.id}
              href={`/dashboard/profile/${m.id}`}
              className="block rounded-lg border border-brand-ink/10 bg-white p-5 transition hover:border-brand-pink/40"
            >
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
              <span className="mt-3 inline-block text-sm font-medium text-brand-pink">
                View application →
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href="/register"
        className="inline-block rounded-md bg-brand-pink px-4 py-2 font-semibold text-white hover:bg-brand-pinkdark"
      >
        Register another dancer
      </Link>
    </div>
  );
}
