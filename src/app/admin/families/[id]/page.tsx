import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { money, formatDateShort, formatTime } from '@/lib/format';
import { SubmitButton, inputClass } from '@/components/ui';
import { CustomPlanForm } from './CustomPlanForm';
import { PasswordResetButton } from './PasswordResetButton';
import { enrollDancer, removeEnrollment, reassignEnrollment, stopBilling } from '../actions';

export const dynamic = 'force-dynamic';

function classLabel(c: any): string {
  return `${c.name} — ${c.day_of_week} ${formatTime(c.start_time)} (${c.location?.name ?? ''})`;
}

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: family } = await supabase
    .from('family_accounts')
    .select(
      'id, parent1_name, parent1_phone, parent1_email, parent2_name, parent2_phone, parent2_email, referral_source',
    )
    .eq('id', id)
    .maybeSingle();
  if (!family) notFound();

  const [membersRes, classesRes] = await Promise.all([
    supabase
      .from('family_members')
      .select(
        `id, first_name, last_name, birthday, gender, medical_notes,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
         enrollments(id, status, class:classes(id, name, day_of_week, start_time, end_time, location:locations(name))),
         payment_plans(id, plan_type, total_amount, installment_schedule, status)`,
      )
      .eq('family_account_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('classes')
      .select('id, name, day_of_week, start_time, end_time, location:locations(name)')
      .order('start_time'),
  ]);

  const members = (membersRes.data ?? []) as any[];
  const classes = (classesRes.data ?? []) as any[];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/families" className="text-sm text-brand-pink hover:underline">
          ← All families
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-pink">{family.parent1_name}</h1>
      </div>

      {/* Family / account */}
      <section className="grid gap-4 rounded-lg border border-brand-ink/10 bg-white p-5 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <h2 className="font-semibold text-brand-ink">Account</h2>
          <p className="text-brand-ink/70">{family.parent1_email}</p>
          {family.parent1_phone && <p className="text-brand-ink/70">{family.parent1_phone}</p>}
          {family.parent2_name && (
            <p className="text-brand-ink/70">
              Parent 2: {family.parent2_name}
              {family.parent2_email ? ` · ${family.parent2_email}` : ''}
            </p>
          )}
          {family.referral_source && (
            <p className="text-brand-ink/50">Referral: {family.referral_source.replace(/_/g, ' ')}</p>
          )}
        </div>
        <div className="sm:text-right">
          <PasswordResetButton email={family.parent1_email} />
        </div>
      </section>

      {/* Dancers */}
      {members.map((m) => {
        const activeEnrollments = (m.enrollments ?? []).filter((e: any) => e.status === 'active' && e.class);
        const activePlan = (m.payment_plans ?? []).find((p: any) => p.status === 'active');
        return (
          <section key={m.id} className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">
                {m.first_name} {m.last_name}
              </h2>
              <p className="text-sm text-brand-ink/60">
                {m.birthday ? `Born ${formatDateShort(m.birthday)}` : 'No birthday on file'}
                {m.gender ? ` · ${m.gender}` : ''}
              </p>
              {m.medical_notes && (
                <p className="mt-1 text-sm text-amber-700">Medical: {m.medical_notes}</p>
              )}
              {m.emergency_contact_name && (
                <p className="text-sm text-brand-ink/60">
                  Emergency: {m.emergency_contact_name} ({m.emergency_contact_relationship}) ·{' '}
                  {m.emergency_contact_phone}
                </p>
              )}
            </div>

            {/* Enrollments */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-brand-ink/80">Classes</h3>
              {activeEnrollments.length === 0 && (
                <p className="text-sm text-brand-ink/60">No active classes.</p>
              )}
              {activeEnrollments.map((e: any) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 border-b border-brand-ink/5 pb-2">
                  <span className="min-w-[14rem] text-sm text-brand-ink">
                    {e.class.name} — {e.class.day_of_week} {formatTime(e.class.start_time)}
                  </span>
                  <form action={reassignEnrollment} className="flex items-center gap-1">
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="family_id" value={family.id} />
                    <select name="new_class_id" defaultValue="" className={`${inputClass} w-64 text-sm`}>
                      <option value="" disabled>
                        Reassign to…
                      </option>
                      {classes
                        .filter((c) => c.id !== e.class.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {classLabel(c)}
                          </option>
                        ))}
                    </select>
                    <SubmitButton pendingText="…">Move</SubmitButton>
                  </form>
                  <form action={removeEnrollment}>
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="family_id" value={family.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              ))}

              {/* Add enrollment */}
              <form action={enrollDancer} className="flex items-center gap-1 pt-1">
                <input type="hidden" name="member_id" value={m.id} />
                <input type="hidden" name="family_id" value={family.id} />
                <select name="class_id" defaultValue="" className={`${inputClass} w-64 text-sm`}>
                  <option value="" disabled>
                    Add to class…
                  </option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)}
                    </option>
                  ))}
                </select>
                <SubmitButton pendingText="…">Add</SubmitButton>
              </form>
            </div>

            {/* Billing */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-brand-ink/80">Billing</h3>
              {activePlan ? (
                <div className="rounded-md bg-brand-pink/5 p-3 text-sm">
                  <div className="font-medium text-brand-ink">
                    {activePlan.plan_type === 'quarterly'
                      ? 'Quarterly (4 installments)'
                      : activePlan.plan_type === 'paid_in_full'
                        ? 'Paid in full'
                        : 'Custom plan'}{' '}
                    · {money(activePlan.total_amount)}
                  </div>
                  <ul className="mt-1 text-brand-ink/60">
                    {(Array.isArray(activePlan.installment_schedule)
                      ? activePlan.installment_schedule
                      : []
                    ).map((i: any, idx: number) => (
                      <li key={idx}>
                        {formatDateShort(i.date)} — {money(i.amount)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-brand-ink/60">No active plan.</p>
              )}

              {activePlan && (
                <details className="rounded-md border border-red-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-red-700">
                    Stop billing
                  </summary>
                  <form action={stopBilling} className="mt-3 space-y-2">
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="family_id" value={family.id} />
                    <p className="text-xs text-brand-ink/60">
                      Halts all future scheduled charges for this dancer. This does{' '}
                      <strong>not</strong> issue a refund. Type <strong>STOP</strong> to confirm.
                    </p>
                    <div className="flex items-center gap-2">
                      <input name="confirm" placeholder="STOP" className={`${inputClass} w-32`} />
                      <button
                        type="submit"
                        className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        Stop billing
                      </button>
                    </div>
                  </form>
                </details>
              )}

              <CustomPlanForm memberId={m.id} familyId={family.id} />
            </div>
          </section>
        );
      })}

      {members.length === 0 && <p className="text-brand-ink/60">No dancers on this account.</p>}
    </div>
  );
}
