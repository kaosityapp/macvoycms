import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isHelcimConfigured } from '@/lib/integrations/helcim';
import { summarizePayments, type PayStatus } from '@/lib/admin/paymentStatus';
import { findDueInstallment } from '@/lib/billing/autoCharge';
import { todayIso, toEasternDateIso } from '@/lib/billing/dueDates';
import { money, formatDateShort, formatDateLong, formatTime, formatTimestamp, formatTimestampShort } from '@/lib/format';
import { POLICIES } from '@/lib/consents/policies';
import { SubmitButton, inputClass } from '@/components/ui';
import { CustomPlanForm } from './CustomPlanForm';
import { ApproveWithTotalForm } from './ApproveWithTotalForm';
import { EditAddonForm } from './EditAddonForm';
import { RecordPaymentForm } from './RecordPaymentForm';
import { RetryInstallmentControls } from './RetryInstallmentControls';
import { PasswordResetButton } from './PasswordResetButton';
import { DeleteDancerButton } from './DeleteDancerButton';
import { CancelStudentButton } from './CancelStudentButton';
import { EditRegistrationForm } from './EditRegistrationForm';
import { ImpersonateButton } from './ImpersonateButton';
import {
  enrollDancer,
  removeEnrollment,
  reassignEnrollment,
  stopBilling,
  reactivateStudent,
} from '../actions';

export const dynamic = 'force-dynamic';

const BADGE: Record<PayStatus, string> = {
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-700',
  on_track: 'bg-brand-pink/10 text-brand-pink',
  no_plan: 'bg-brand-ink/10 text-brand-ink/60',
};

function classLabel(c: any): string {
  return `${c.name} — ${c.day_of_week} ${formatTime(c.start_time)} (${c.location?.name ?? ''})`;
}

export default async function DancerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // family_member id
  const supabase = await createClient();
  const today = todayIso();
  const billingActive = isHelcimConfigured();

  const { data: dancer } = await supabase
    .from('family_members')
    .select(
      `id, first_name, last_name, status, address, city, province, postal_code, phone_number, phone_type, birthday, gender, medical_notes,
       dancer_type, guardian1_name, guardian1_phone, guardian1_email, guardian2_name, guardian2_phone, guardian2_email,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, created_at,
       family:family_accounts(id, parent1_name, parent1_phone, parent1_email, parent2_name, parent2_phone, parent2_email, referral_source),
       enrollments(id, status, class:classes(id, name, day_of_week, start_time, end_time, is_private, location:locations(name))),
       payment_plans(id, plan_type, total_amount, installment_schedule, status, auto_charge, stored_card_token, stored_bank_customer_id, stored_bank_account_id),
       payments(id, amount, category, paid_at, method, note),
       consents(type, agreed_at),
       order_items(item_type, amount)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (!dancer) notFound();

  const d = dancer as any;
  const family = d.family;
  const activePlan = (d.payment_plans ?? []).find((p: any) => p.status === 'active') ?? null;
  const summary = summarizePayments(activePlan, d.payments ?? [], today, billingActive);
  const activeEnrollments = (d.enrollments ?? []).filter((e: any) => e.status === 'active' && e.class);
  const paidPayments = (d.payments ?? []).filter((p: any) => p.paid_at);
  const installments: { date: string; amount: number }[] = Array.isArray(activePlan?.installment_schedule)
    ? activePlan.installment_schedule
    : [];
  const dueInstallment = findDueInstallment(installments, summary.paid, today);
  const consentByType = new Map((d.consents ?? []).map((c: any) => [c.type, c.agreed_at]));

  const { data: classesData } = await supabase
    .from('classes')
    .select('id, name, day_of_week, start_time, location:locations(name)')
    .eq('is_private', false)
    .order('start_time');
  const classes = (classesData ?? []) as any[];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/families" className="text-sm text-brand-pink hover:underline">
          ← All dancers
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-brand-pink">
            {d.first_name} {d.last_name}
          </h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[summary.status]}`}>
            {summary.label}
          </span>
          {d.status === 'removed' && (
            <span className="rounded-full bg-brand-ink/10 px-2 py-0.5 text-xs font-semibold text-brand-ink/60">
              Cancelled
            </span>
          )}
          {d.status === 'pending_pricing' && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
              Needs pricing
            </span>
          )}
        </div>
        <p className="text-sm text-brand-ink/60">{family?.parent1_email}</p>
      </div>

      {d.status === 'pending_pricing' && (
        <div className="rounded-md bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Registered directly — not on the spreadsheet. Waivers and their class spot are already
          saved below. Set a price using <strong>Approve with a total price</strong> in Payments —
          saving it approves this dancer and emails the family to log in and choose their plan.
        </div>
      )}

      {/* ===== Payments ===== */}
      <section className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-brand-pink">Payments</h2>
          {activePlan && (
            <span className="text-sm text-brand-ink/60">
              {activePlan.plan_type === 'monthly'
                ? 'Monthly'
                : activePlan.plan_type === 'paid_in_full'
                  ? 'Paid in full'
                  : 'Custom'}{' '}
              · {money(activePlan.total_amount)} total
              {summary.paid > 0 && ` · ${money(summary.paid)} paid`}
            </span>
          )}
        </div>

        {/* Scheduled */}
        <div>
          <h3 className="text-sm font-semibold text-brand-ink/80">Scheduled</h3>
          {installments.length === 0 ? (
            <p className="mt-1 text-sm text-brand-ink/60">No active plan.</p>
          ) : (
            <ul className="mt-1 divide-y divide-brand-ink/5 text-sm">
              {installments.map((i, idx) => {
                const past = i.date < today;
                const isDue = billingActive && dueInstallment?.index === idx;
                return (
                  <li key={idx} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="text-brand-ink">
                      {formatDateShort(i.date)} — {money(i.amount)}
                    </span>
                    <span className="flex items-center gap-3">
                      <span
                        className={`text-xs ${
                          past ? (billingActive ? 'text-red-600' : 'text-brand-ink/50') : 'text-brand-ink/50'
                        }`}
                      >
                        {past ? (billingActive ? 'overdue' : 'due') : 'upcoming'}
                      </span>
                      {isDue && activePlan?.id && (
                        <RetryInstallmentControls
                          memberId={d.id}
                          planId={activePlan.id}
                          installmentIndex={idx}
                          hasPaymentMethod={Boolean(
                            activePlan.stored_card_token ||
                              (activePlan.stored_bank_customer_id && activePlan.stored_bank_account_id),
                          )}
                        />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Completed */}
        <div>
          <h3 className="text-sm font-semibold text-brand-ink/80">Completed</h3>
          {paidPayments.length === 0 ? (
            <p className="mt-1 text-sm text-brand-ink/60">
              No payments recorded yet{!billingActive && ' (activates with Helcim)'}.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-brand-ink/5 text-sm">
              {paidPayments.map((p: any) => (
                <li key={p.id} className="flex items-center justify-between py-1.5">
                  <span className="text-brand-ink">
                    {money(p.amount)}{' '}
                    <span className="capitalize text-brand-ink/50">
                      · {p.category}
                      {p.method && p.method !== 'helcim' ? ` · ${p.method}` : ''}
                    </span>
                    {p.note && <span className="text-brand-ink/40"> — {p.note}</span>}
                  </span>
                  <span className="text-xs text-brand-ink/50">{formatTimestamp(p.paid_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Billing actions */}
        <div className="flex flex-wrap items-start gap-4 border-t border-brand-ink/10 pt-4">
          {d.status === 'pending_pricing' && <ApproveWithTotalForm memberId={d.id} />}
          <RecordPaymentForm memberId={d.id} />
          <CustomPlanForm memberId={d.id} familyId={family?.id ?? ''} />
          {activePlan && (
            <details className="rounded-md border border-red-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-red-700">Stop billing</summary>
              <form action={stopBilling} className="mt-3 space-y-2">
                <input type="hidden" name="member_id" value={d.id} />
                <p className="text-xs text-brand-ink/60">
                  Halts future scheduled charges. Does <strong>not</strong> refund. Type{' '}
                  <strong>STOP</strong> to confirm.
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
        </div>
      </section>

      {/* ===== Registration form ===== */}
      <section className="space-y-5 rounded-lg border border-brand-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-brand-pink">Registration</h2>
          <span className="text-sm text-brand-ink/50">Registered {formatDateLong(d.created_at ? toEasternDateIso(d.created_at) : today)}</span>
        </div>

        <EditRegistrationForm
          memberId={d.id}
          familyId={family?.id ?? ''}
          dancer={{
            first_name: d.first_name,
            last_name: d.last_name,
            birthday: d.birthday,
            gender: d.gender,
            address: d.address,
            city: d.city,
            province: d.province,
            postal_code: d.postal_code,
            phone_number: d.phone_number,
            phone_type: d.phone_type,
            medical_notes: d.medical_notes,
            dancer_type: d.dancer_type,
            guardian1_name: d.guardian1_name,
            guardian1_phone: d.guardian1_phone,
            guardian1_email: d.guardian1_email,
            guardian2_name: d.guardian2_name,
            guardian2_phone: d.guardian2_phone,
            guardian2_email: d.guardian2_email,
            emergency_contact_name: d.emergency_contact_name,
            emergency_contact_phone: d.emergency_contact_phone,
            emergency_contact_relationship: d.emergency_contact_relationship,
          }}
          family={family}
        />

        {family?.referral_source && (
          <p className="text-sm text-brand-ink/60">
            Referral: {String(family.referral_source).replace(/_/g, ' ')}
          </p>
        )}
        <PasswordResetButton email={family?.parent1_email ?? ''} />

        {/* Add-ons */}
        <EditAddonForm memberId={d.id} current={(d.order_items ?? [])[0]?.item_type ?? 'none'} />

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
                    {agreedAt ? `agreed ${formatTimestampShort(String(agreedAt))}` : 'not agreed'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ===== Classes / enrollment ===== */}
      <section className="space-y-3 rounded-lg border border-brand-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-pink">Classes</h2>
        {activeEnrollments.length === 0 && <p className="text-sm text-brand-ink/60">No active classes.</p>}
        {activeEnrollments.map((e: any) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 border-b border-brand-ink/5 pb-2">
            <span className="min-w-[14rem] text-sm text-brand-ink">
              {e.class.name}
              {e.class.is_private && <span className="ml-1 text-xs font-semibold text-brand-pink">(private)</span>} —{' '}
              {e.class.day_of_week} {formatTime(e.class.start_time)}
            </span>
            <form action={reassignEnrollment} className="flex items-center gap-1">
              <input type="hidden" name="enrollment_id" value={e.id} />
              <input type="hidden" name="member_id" value={d.id} />
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
              <input type="hidden" name="member_id" value={d.id} />
              <button type="submit" className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </form>
          </div>
        ))}

        <form action={enrollDancer} className="flex items-center gap-1 pt-1">
          <input type="hidden" name="member_id" value={d.id} />
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
      </section>

      {/* ===== Actions ===== */}
      <section className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/families/${d.id}/view`}
            className="inline-block rounded-md border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink hover:bg-brand-pink/5"
          >
            Quick view — upcoming schedule only
          </Link>
        </div>
        <ImpersonateButton memberId={d.id} />
        <div className="flex flex-wrap items-center gap-3 border-t border-brand-ink/10 pt-4">
          {d.status === 'removed' ? (
            <form action={reactivateStudent}>
              <input type="hidden" name="member_id" value={d.id} />
              <button
                type="submit"
                className="rounded-md border border-brand-ink/30 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-ink/5"
              >
                Reactivate student
              </button>
            </form>
          ) : (
            <CancelStudentButton memberId={d.id} name={`${d.first_name} ${d.last_name}`} />
          )}
          <DeleteDancerButton memberId={d.id} name={`${d.first_name} ${d.last_name}`} />
        </div>
        <p className="text-xs text-brand-ink/50">
          <strong>Cancel student</strong> stops future billing and removes them from their class(es)
          — just this dancer, not the whole family account. Their record, payment history, and
          waivers are kept, and you can reactivate any time. <strong>Delete</strong> permanently
          erases everything and cannot be undone.
        </p>
      </section>
    </div>
  );
}
