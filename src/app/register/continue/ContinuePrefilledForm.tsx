'use client';

import { useActionState, useMemo, useState } from 'react';
import { completePendingRegistration, type CompleteRegistrationState } from './actions';
import { POLICIES } from '@/lib/consents/policies';
import { Field, FormError, SubmitButton, inputClass } from '@/components/ui';
import { money, formatDateLong, formatTime } from '@/lib/format';

interface ClassItem {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  name: string;
  location_id: string;
}
interface Group {
  location: { id: string; name: string };
  classes: ClassItem[];
}

interface DancerPrefill {
  first_name: string;
  last_name: string;
  birthday?: string;
  gender?: string;
  address?: string;
  medical_notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  class_ids: string[];
  plan_type?: string;
  total_amount: number;
  installment_schedule: { date: string; amount: number }[];
}

interface PendingInfo {
  parent1_name: string | null;
  parent1_phone: string | null;
  parent2_name: string | null;
  parent2_phone: string | null;
  parent2_email: string | null;
}

const PLAN_LABEL: Record<string, string> = {
  quarterly: 'Quarterly (4 installments)',
  paid_in_full: 'Paid in full',
  custom: 'Custom plan',
};

export function ContinuePrefilledForm({
  email,
  pending,
  dancers,
  groups,
}: {
  email: string;
  pending: PendingInfo;
  dancers: DancerPrefill[];
  groups: Group[];
}) {
  const [state, action] = useActionState<CompleteRegistrationState, FormData>(
    completePendingRegistration,
    {},
  );
  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const allAgreed = agreed.size === POLICIES.length;

  const classById = useMemo(() => {
    const map = new Map<string, ClassItem & { location_name: string }>();
    for (const g of groups) {
      for (const c of g.classes) map.set(c.id, { ...c, location_name: g.location.name });
    }
    return map;
  }, [groups]);

  function toggleAgreed(type: string, checked: boolean) {
    setAgreed((prev) => {
      const next = new Set(prev);
      if (checked) next.add(type);
      else next.delete(type);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-10">
      {/* Account holder — editable */}
      <section className="space-y-4 rounded-lg bg-brand-pink/5 p-5">
        <h2 className="text-lg font-semibold text-brand-pink">Account holder</h2>
        <p className="text-sm text-brand-ink/60">
          Login email: <strong>{email}</strong> (can&apos;t be changed here)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parent 1 name" htmlFor="parent1Name" required>
            <input
              id="parent1Name"
              name="parent1Name"
              required
              defaultValue={pending.parent1_name ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 1 phone" htmlFor="parent1Phone">
            <input
              id="parent1Phone"
              name="parent1Phone"
              defaultValue={pending.parent1_phone ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 2 name" htmlFor="parent2Name">
            <input
              id="parent2Name"
              name="parent2Name"
              defaultValue={pending.parent2_name ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 2 phone" htmlFor="parent2Phone">
            <input
              id="parent2Phone"
              name="parent2Phone"
              defaultValue={pending.parent2_phone ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 2 email" htmlFor="parent2Email">
            <input
              id="parent2Email"
              name="parent2Email"
              type="email"
              defaultValue={pending.parent2_email ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {/* Dancers — personal details editable, classes/payment read-only */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-brand-pink">Your dancer(s)</h2>
        {dancers.map((d, i) => (
          <DancerFields key={i} index={i} dancer={d} classById={classById} />
        ))}
      </section>

      {/* Password */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-pink">Set your password</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" required hint="At least 8 characters.">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword" required>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {/* Waivers — one agreement covers every dancer on this account */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Agreements</h2>
        <p className="text-sm text-brand-ink/70">
          These apply to all {dancers.length > 1 ? 'dancers' : 'the dancer'} on this account. All{' '}
          {POLICIES.length} are required —{' '}
          <span className={allAgreed ? 'text-green-700' : 'font-semibold text-brand-pink'}>
            {agreed.size} of {POLICIES.length} agreed
          </span>
          .
        </p>
        <div className="space-y-2">
          {POLICIES.map((policy) => (
            <div key={policy.type} className="rounded-md border border-brand-ink/10 p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={`consent_${policy.type}`}
                  required
                  onChange={(e) => toggleAgreed(policy.type, e.target.checked)}
                  className="mt-1 h-4 w-4 accent-brand-pink"
                />
                <span className="text-sm">{policy.label}</span>
              </label>
              <details className="mt-1 pl-7 text-xs text-brand-ink/60">
                <summary className="cursor-pointer select-none text-brand-pink">
                  Read {policy.title}
                </summary>
                <p className="mt-2">{policy.text}</p>
              </details>
            </div>
          ))}
        </div>
      </section>

      <FormError message={state.error} />
      <SubmitButton pendingText="Submitting…" disabled={!allAgreed}>
        Complete registration
      </SubmitButton>
    </form>
  );
}

function DancerFields({
  index,
  dancer,
  classById,
}: {
  index: number;
  dancer: DancerPrefill;
  classById: Map<string, ClassItem & { location_name: string }>;
}) {
  const resolvedClasses = (dancer.class_ids ?? []).map((id) => classById.get(id)).filter(Boolean) as (ClassItem & {
    location_name: string;
  })[];

  return (
    <div className="space-y-4 rounded-lg border border-brand-ink/10 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor={`firstName_${index}`} required>
          <input
            id={`firstName_${index}`}
            name={`firstName_${index}`}
            required
            defaultValue={dancer.first_name}
            className={inputClass}
          />
        </Field>
        <Field label="Last name" htmlFor={`lastName_${index}`} required>
          <input
            id={`lastName_${index}`}
            name={`lastName_${index}`}
            required
            defaultValue={dancer.last_name}
            className={inputClass}
          />
        </Field>
        <Field label="Birthday" htmlFor={`birthday_${index}`}>
          <input
            id={`birthday_${index}`}
            name={`birthday_${index}`}
            type="date"
            defaultValue={dancer.birthday ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Gender" htmlFor={`gender_${index}`}>
          <select
            id={`gender_${index}`}
            name={`gender_${index}`}
            defaultValue={dancer.gender ?? ''}
            className={inputClass}
          >
            <option value="">Select…</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </Field>
      </div>
      <Field label="Address" htmlFor={`address_${index}`}>
        <input
          id={`address_${index}`}
          name={`address_${index}`}
          defaultValue={dancer.address ?? ''}
          className={inputClass}
        />
      </Field>
      <Field label="Medical conditions / medications / allergies" htmlFor={`medicalNotes_${index}`}>
        <textarea
          id={`medicalNotes_${index}`}
          name={`medicalNotes_${index}`}
          rows={2}
          defaultValue={dancer.medical_notes ?? ''}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Emergency contact name" htmlFor={`emergencyName_${index}`}>
          <input
            id={`emergencyName_${index}`}
            name={`emergencyName_${index}`}
            defaultValue={dancer.emergency_contact_name ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Emergency contact phone" htmlFor={`emergencyPhone_${index}`}>
          <input
            id={`emergencyPhone_${index}`}
            name={`emergencyPhone_${index}`}
            defaultValue={dancer.emergency_contact_phone ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Relationship" htmlFor={`emergencyRelationship_${index}`}>
          <input
            id={`emergencyRelationship_${index}`}
            name={`emergencyRelationship_${index}`}
            defaultValue={dancer.emergency_contact_relationship ?? ''}
            className={inputClass}
          />
        </Field>
      </div>

      {/* Classes — read-only. Changing a class can change the rate the school
          set, so this goes through Debbie rather than being self-service. */}
      <div>
        <h4 className="text-sm font-semibold text-brand-ink/80">Classes</h4>
        {resolvedClasses.length === 0 ? (
          <p className="mt-1 text-sm text-amber-700">
            No class on file yet — contact the school to confirm.
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-brand-ink/70">
            {resolvedClasses.map((c) => (
              <li key={c.id}>
                {c.name} — {c.day_of_week} {formatTime(c.start_time)}–{formatTime(c.end_time)} ·{' '}
                {c.location_name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-brand-ink/50">
          Need to change classes? Contact the school — your rate may change.
        </p>
      </div>

      {/* Payment plan — read-only, set by the school */}
      <div>
        <h4 className="text-sm font-semibold text-brand-ink/80">Payment plan</h4>
        {dancer.total_amount > 0 ? (
          <>
            <p className="text-sm text-brand-ink/70">
              {PLAN_LABEL[dancer.plan_type ?? 'custom'] ?? 'Custom plan'} · {money(dancer.total_amount)}{' '}
              total
            </p>
            {dancer.installment_schedule?.length > 0 && (
              <ul className="mt-1 text-sm text-brand-ink/60">
                {dancer.installment_schedule.map((inst, ii) => (
                  <li key={ii}>
                    {formatDateLong(inst.date)} — {money(inst.amount)}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-brand-ink/60">No plan set yet — the school will follow up.</p>
        )}
        <p className="mt-1 text-xs text-brand-ink/50">
          Payment amount isn&apos;t editable here — contact the school if this needs to change.
        </p>
      </div>
    </div>
  );
}
