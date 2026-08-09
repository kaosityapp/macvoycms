import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/billing/dueDates';
import { money, formatDateLong, formatDateShort, formatTime } from '@/lib/format';
import { POLICIES } from '@/lib/consents/policies';

export const dynamic = 'force-dynamic';

/** Read-only view of a dancer's own registration/application — no editing. */
export default async function DancerApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayIso();

  // RLS (owns_family_member / family_account_id match) means this only ever
  // returns a dancer belonging to the signed-in family.
  const { data: dancer } = await supabase
    .from('family_members')
    .select(
      `id, first_name, last_name, address, birthday, gender, medical_notes,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, created_at,
       family:family_accounts(parent1_name, parent1_phone, parent1_email, parent2_name, parent2_phone, parent2_email, referral_source),
       enrollments(status, class:classes(id, name, day_of_week, start_time, end_time, location:locations(name))),
       payment_plans(plan_type, total_amount, installment_schedule, status),
       consents(type, agreed_at),
       order_items(item_type, amount)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!dancer) notFound();

  const d = dancer as any;
  const family = d.family;
  const activeEnrollments = (d.enrollments ?? []).filter((e: any) => e.status === 'active' && e.class);
  const activePlan = (d.payment_plans ?? []).find((p: any) => p.status === 'active') ?? null;
  const consentByType = new Map((d.consents ?? []).map((c: any) => [c.type, c.agreed_at]));

  const classIds = activeEnrollments.map((e: any) => e.class.id);
  let nextClass: any = null;
  if (classIds.length) {
    const { data } = await supabase
      .from('class_sessions')
      .select('session_date, start_time, class:classes(name, location:locations(name))')
      .in('class_id', classIds)
      .gte('session_date', today)
      .in('status', ['scheduled', 'rescheduled'])
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();
    nextClass = data;
  }

  const schedule: { date: string; amount: number }[] = Array.isArray(activePlan?.installment_schedule)
    ? activePlan.installment_schedule
    : [];
  const nextPayment = [...schedule].filter((i) => i.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard/profile" className="text-sm text-brand-pink hover:underline">
          ← Profile
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-pink">
          {d.first_name} {d.last_name}
        </h1>
      </div>

      {/* Next class / Next payment */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-brand-ink/10 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-pinkdark">
            Next class
          </div>
          {nextClass ? (
            <div className="mt-2">
              <div className="font-semibold text-brand-ink">{nextClass.class?.name}</div>
              <div className="text-sm text-brand-ink/60">
                {formatDateLong(nextClass.session_date)} · {formatTime(nextClass.start_time)}
                {nextClass.class?.location?.name ? ` · ${nextClass.class.location.name}` : ''}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-brand-ink/50">No upcoming classes</div>
          )}
        </div>
        <div className="rounded-lg border border-brand-ink/10 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-pinkdark">
            Next payment
          </div>
          {nextPayment ? (
            <div className="mt-2">
              <div className="font-semibold text-brand-ink">{money(nextPayment.amount)}</div>
              <div className="text-sm text-brand-ink/60">{formatDateShort(nextPayment.date)}</div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-brand-ink/50">Nothing scheduled</div>
          )}
        </div>
      </div>

      {/* Application (read-only) */}
      <section className="space-y-5 rounded-lg border border-brand-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-brand-pink">Registration</h2>
          <span className="text-xs text-brand-ink/50">
            Submitted {formatDateLong((d.created_at ?? today).slice(0, 10))} · view only
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold text-brand-ink">Dancer</h3>
            <Row label="Birthday" value={d.birthday ? formatDateShort(d.birthday) : '—'} />
            <Row label="Gender" value={d.gender || '—'} />
            <Row label="Address" value={d.address || '—'} />
            <Row label="Medical" value={d.medical_notes || 'None'} />
            <Row
              label="Emergency contact"
              value={
                d.emergency_contact_name
                  ? `${d.emergency_contact_name} (${d.emergency_contact_relationship ?? ''}) · ${d.emergency_contact_phone ?? ''}`
                  : '—'
              }
            />
          </div>
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold text-brand-ink">Account holder</h3>
            <Row
              label="Parent 1"
              value={`${family?.parent1_name ?? ''}${family?.parent1_phone ? ` · ${family.parent1_phone}` : ''}`}
            />
            <Row label="Email" value={family?.parent1_email ?? ''} />
            {family?.parent2_name && (
              <Row
                label="Parent 2"
                value={`${family.parent2_name}${family.parent2_email ? ` · ${family.parent2_email}` : ''}`}
              />
            )}
            <Row
              label="Referral"
              value={family?.referral_source ? String(family.referral_source).replace(/_/g, ' ') : '—'}
            />
          </div>
        </div>

        {/* Classes */}
        <div className="text-sm">
          <h3 className="font-semibold text-brand-ink">Classes</h3>
          {activeEnrollments.length === 0 ? (
            <p className="mt-1 text-brand-ink/60">No active classes.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-brand-ink/70">
              {activeEnrollments.map((e: any) => (
                <li key={e.class.id}>
                  {e.class.name} — {e.class.day_of_week} {formatTime(e.class.start_time)}
                  {e.class.location?.name ? ` · ${e.class.location.name}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add-ons */}
        {(d.order_items ?? []).length > 0 && (
          <div className="text-sm">
            <h3 className="font-semibold text-brand-ink">Add-ons</h3>
            <ul className="mt-1 text-brand-ink/70">
              {d.order_items.map((o: any, i: number) => (
                <li key={i} className="capitalize">
                  {o.item_type} — {money(o.amount)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Waivers */}
        <div className="text-sm">
          <h3 className="font-semibold text-brand-ink">Agreements</h3>
          <ul className="mt-1 space-y-1">
            {POLICIES.map((policy) => {
              const agreedAt = consentByType.get(policy.type);
              return (
                <li key={policy.type} className="flex items-center justify-between">
                  <span className="text-brand-ink/80">{policy.title}</span>
                  <span className={`text-xs ${agreedAt ? 'text-green-700' : 'text-brand-ink/40'}`}>
                    {agreedAt ? `agreed ${formatDateShort(String(agreedAt).slice(0, 10))}` : 'not agreed'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Payment plan summary */}
        {activePlan && (
          <div className="text-sm">
            <h3 className="font-semibold text-brand-ink">Payment plan</h3>
            <p className="mt-1 text-brand-ink/70">
              {activePlan.plan_type === 'quarterly'
                ? 'Quarterly (4 installments)'
                : activePlan.plan_type === 'paid_in_full'
                  ? 'Paid in full'
                  : 'Custom plan'}{' '}
              · {money(activePlan.total_amount)} total
            </p>
          </div>
        )}
      </section>

      <p className="text-xs text-brand-ink/50">
        Need to change something here? Contact the school directly — this page is view-only.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-brand-ink/70">
      <span className="text-brand-ink/50">{label}:</span> {value}
    </p>
  );
}
