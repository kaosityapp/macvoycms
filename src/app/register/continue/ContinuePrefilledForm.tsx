'use client';

import { useActionState } from 'react';
import { completePendingRegistration, type CompleteRegistrationState } from './actions';
import { POLICIES } from '@/lib/consents/policies';
import { Field, FormError, SubmitButton, inputClass } from '@/components/ui';
import { money, formatDateShort, formatDateLong, formatTime } from '@/lib/format';

interface ClassDisplay {
  name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  location_name: string;
}

interface DancerDisplay {
  first_name: string;
  last_name: string;
  birthday?: string;
  classes: ClassDisplay[];
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
}: {
  email: string;
  pending: PendingInfo;
  dancers: DancerDisplay[];
}) {
  const [state, action] = useActionState<CompleteRegistrationState, FormData>(
    completePendingRegistration,
    {},
  );

  return (
    <form action={action} className="space-y-10">
      {/* Account holder — read-only, confirmed from our records */}
      <section className="space-y-2 rounded-lg bg-brand-pink/5 p-5">
        <h2 className="text-lg font-semibold text-brand-pink">Account holder</h2>
        <p className="text-sm text-brand-ink/80">
          {pending.parent1_name} · {email}
          {pending.parent1_phone ? ` · ${pending.parent1_phone}` : ''}
        </p>
        {pending.parent2_name && (
          <p className="text-sm text-brand-ink/80">
            {pending.parent2_name}
            {pending.parent2_phone ? ` · ${pending.parent2_phone}` : ''}
            {pending.parent2_email ? ` · ${pending.parent2_email}` : ''}
          </p>
        )}
        <p className="text-xs text-brand-ink/50">
          Something wrong here? Contact the school directly before submitting.
        </p>
      </section>

      {/* Dancers — read-only summary */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-pink">Your dancer(s)</h2>
        {dancers.map((d, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-brand-ink/10 p-5">
            <h3 className="font-semibold text-brand-ink">
              {d.first_name} {d.last_name}
              {d.birthday && (
                <span className="ml-2 text-sm font-normal text-brand-ink/60">
                  Born {formatDateShort(d.birthday)}
                </span>
              )}
            </h3>

            <div>
              <h4 className="text-sm font-semibold text-brand-ink/80">Classes</h4>
              {d.classes.length === 0 ? (
                <p className="text-sm text-brand-ink/60">No classes on file.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm text-brand-ink/70">
                  {d.classes.map((c, ci) => (
                    <li key={ci}>
                      {c.name} — {c.day_of_week} {formatTime(c.start_time)}–{formatTime(c.end_time)}
                      {c.location_name ? ` · ${c.location_name}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-brand-ink/80">Payment plan</h4>
              <p className="text-sm text-brand-ink/70">
                {PLAN_LABEL[d.plan_type ?? 'custom'] ?? 'Custom plan'} · {money(d.total_amount)} total
              </p>
              {d.installment_schedule.length > 0 && (
                <ul className="mt-1 text-sm text-brand-ink/60">
                  {d.installment_schedule.map((inst, ii) => (
                    <li key={ii}>
                      {formatDateLong(inst.date)} — {money(inst.amount)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
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

      {/* Waivers */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Agreements</h2>
        <p className="text-sm text-brand-ink/70">All are required to register.</p>
        <div className="space-y-2">
          {POLICIES.map((policy) => (
            <div key={policy.type} className="rounded-md border border-brand-ink/10 p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={`consent_${policy.type}`}
                  required
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
      <SubmitButton pendingText="Submitting…">Complete registration</SubmitButton>
    </form>
  );
}
