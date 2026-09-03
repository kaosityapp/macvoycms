'use client';

import { useActionState, useMemo, useState } from 'react';
import { registerDancer, type RegistrationState } from './actions';
import { POLICIES } from '@/lib/consents/policies';
import { ADDON_OPTIONS } from '@/lib/constants/addons';
import { Field, FormError, SubmitButton, inputClass, labelClass } from '@/components/ui';

interface ClassItem {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  name: string;
  level: string;
  shoe_type: string;
  age_min: number | null;
  age_max: number | null;
  hourly_rate: number | null;
  total_sessions: number | null;
}
interface Group {
  location: { id: string; name: string };
  classes: ClassItem[];
}

const REFERRAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'internet_search', label: 'Internet search' },
  { value: 'social_media', label: 'Social media' },
  { value: 'local_irish_club', label: 'Local Irish club' },
  { value: 'word_of_mouth', label: 'Word of mouth' },
  { value: 'returning_dancer', label: 'Returning dancer' },
  { value: 'restyling_transfer', label: 'Transfer from another school' },
];

function timeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function durationMinutes(start: string, end: string): number {
  return timeMinutes(end) - timeMinutes(start);
}
function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${period}`;
}
function ageLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'All ages';
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  return `Up to age ${max}`;
}
function money(n: number): string {
  return `$${n.toFixed(2)}`;
}
function classPrice(c: ClassItem): number | null {
  if (c.hourly_rate == null || c.total_sessions == null) return null;
  const hours = durationMinutes(c.start_time, c.end_time) / 60;
  return Math.round(c.hourly_rate * hours * c.total_sessions * 100) / 100;
}

export function RegistrationForm({
  groups,
  isLoggedIn,
  parentName,
  initialEmail,
}: {
  groups: Group[];
  isLoggedIn: boolean;
  parentName: string | null;
  initialEmail?: string;
}) {
  const [state, action] = useActionState<RegistrationState, FormData>(registerDancer, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [planType, setPlanType] = useState<'quarterly' | 'paid_in_full'>('quarterly');
  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const allAgreed = agreed.size === POLICIES.length;

  function toggleAgreed(type: string, checked: boolean) {
    setAgreed((prev) => {
      const next = new Set(prev);
      if (checked) next.add(type);
      else next.delete(type);
      return next;
    });
  }

  const allClasses = useMemo(() => groups.flatMap((g) => g.classes), [groups]);

  const { tuition, hasUnpriced } = useMemo(() => {
    let total = 0;
    let unpriced = false;
    for (const c of allClasses) {
      if (!selected.has(c.id)) continue;
      const price = classPrice(c);
      if (price == null) unpriced = true;
      else total += price;
    }
    return { tuition: Math.round(total * 100) / 100, hasUnpriced: unpriced };
  }, [selected, allClasses]);

  const installment = Math.round((tuition / 4) * 100) / 100;

  function toggleClass(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={action} className="space-y-10">
      {/* ---- Account / parent ---- */}
      {isLoggedIn ? (
        <section className="rounded-lg bg-brand-pink/5 px-4 py-3 text-sm text-brand-ink/80">
          Registering another dancer under{' '}
          <span className="font-semibold">{parentName}</span>&apos;s account.
        </section>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-brand-pink">Parent / guardian</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Parent 1 name" htmlFor="parent1Name" required>
              <input id="parent1Name" name="parent1Name" required className={inputClass} />
            </Field>
            <Field label="Parent 1 phone" htmlFor="parent1Phone">
              <input id="parent1Phone" name="parent1Phone" className={inputClass} />
            </Field>
            <Field label="Parent 1 email" htmlFor="parent1Email" required hint="This is your login.">
              <input
                id="parent1Email"
                name="parent1Email"
                type="email"
                required
                defaultValue={initialEmail}
                className={inputClass}
              />
            </Field>
            <Field label="Create a password" htmlFor="password" required hint="At least 8 characters.">
              <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputClass} />
            </Field>
            <Field label="Parent 2 name" htmlFor="parent2Name">
              <input id="parent2Name" name="parent2Name" className={inputClass} />
            </Field>
            <Field label="Parent 2 phone" htmlFor="parent2Phone">
              <input id="parent2Phone" name="parent2Phone" className={inputClass} />
            </Field>
            <Field label="Parent 2 email" htmlFor="parent2Email">
              <input id="parent2Email" name="parent2Email" type="email" className={inputClass} />
            </Field>
            <Field label="How did you hear about us?" htmlFor="referralSource">
              <select id="referralSource" name="referralSource" className={inputClass} defaultValue="">
                <option value="">Select…</option>
                {REFERRAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      )}

      {/* ---- Dancer ---- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-pink">Dancer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName" required>
            <input id="firstName" name="firstName" required className={inputClass} />
          </Field>
          <Field label="Last name" htmlFor="lastName" required>
            <input id="lastName" name="lastName" required className={inputClass} />
          </Field>
          <Field label="Address" htmlFor="address">
            <input id="address" name="address" className={inputClass} />
          </Field>
          <Field label="Birthday" htmlFor="birthday">
            <input id="birthday" name="birthday" type="date" className={inputClass} />
          </Field>
          <Field label="Gender" htmlFor="gender">
            <select id="gender" name="gender" className={inputClass} defaultValue="">
              <option value="">Select…</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>
        </div>
        <Field
          label="Medical conditions / medications / allergies"
          htmlFor="medicalNotes"
          hint="Anything an instructor should know in an emergency."
        >
          <textarea id="medicalNotes" name="medicalNotes" rows={3} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Emergency contact name" htmlFor="emergencyName">
            <input id="emergencyName" name="emergencyName" className={inputClass} />
          </Field>
          <Field label="Emergency contact phone" htmlFor="emergencyPhone">
            <input id="emergencyPhone" name="emergencyPhone" className={inputClass} />
          </Field>
          <Field label="Relationship" htmlFor="emergencyRelationship">
            <input id="emergencyRelationship" name="emergencyRelationship" className={inputClass} />
          </Field>
        </div>
      </section>

      {/* ---- Classes ---- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-pink">Classes</h2>
        <p className="text-sm text-brand-ink/70">
          Select one or more classes. Combined schedules (e.g. Monday + Thursday advanced) are
          just multiple selections — tuition is the sum of each.
        </p>
        {groups.map((group) => (
          <div key={group.location.id} className="space-y-2">
            <h3 className="font-medium text-brand-ink">{group.location.name}</h3>
            <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10">
              {group.classes.map((c) => {
                const price = classPrice(c);
                return (
                  <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      name="classIds"
                      value={c.id}
                      checked={selected.has(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="mt-1 h-4 w-4 accent-brand-pink"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-sm text-brand-ink/70">
                          {price != null ? money(price) : 'price TBD'}
                        </span>
                      </div>
                      <div className="text-sm text-brand-ink/60">
                        {c.day_of_week} · {formatTime(c.start_time)}–{formatTime(c.end_time)} ·{' '}
                        {ageLabel(c.age_min, c.age_max)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {hasUnpriced && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            One or more selected classes don&apos;t have a rate set yet — the school will confirm
            that price with you.
          </p>
        )}
      </section>

      {/* ---- Add-ons ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Add-ons</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {ADDON_OPTIONS.map((o, i) => (
            <label
              key={o.value}
              className="flex items-center gap-3 rounded-md border border-brand-ink/10 px-3 py-2"
            >
              <input
                type="radio"
                name="addon"
                value={o.value}
                defaultChecked={i === 0}
                className="h-4 w-4 accent-brand-pink"
              />
              <span className="flex-1">{o.label}</span>
              {o.amount > 0 && <span className="text-sm text-brand-ink/70">{money(o.amount)}</span>}
            </label>
          ))}
        </div>
        <p className="text-xs text-brand-ink/50">Add-on prices to be confirmed.</p>
      </section>

      {/* ---- Payment plan ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Payment plan</h2>
        <div className="rounded-lg border border-brand-ink/10 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-brand-ink/70">Tuition total</span>
            <span className="text-xl font-bold text-brand-pink">{money(tuition)}</span>
          </div>
          <div className="mt-4 space-y-2">
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="planType"
                value="quarterly"
                checked={planType === 'quarterly'}
                onChange={() => setPlanType('quarterly')}
                className="mt-1 h-4 w-4 accent-brand-pink"
              />
              <span>
                <span className="font-medium">Quarterly</span> — 4 installments of about{' '}
                {money(installment)}
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="radio"
                name="planType"
                value="paid_in_full"
                checked={planType === 'paid_in_full'}
                onChange={() => setPlanType('paid_in_full')}
                className="mt-1 h-4 w-4 accent-brand-pink"
              />
              <span>
                <span className="font-medium">Pay in full</span> — {money(tuition)} once
              </span>
            </label>
          </div>
        </div>
        <p className="text-xs text-brand-ink/50">
          Online payment is set up once the school connects its payment processor. For now this
          records your plan.
        </p>
      </section>

      {/* ---- Waivers ---- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Agreements</h2>
        <p className="text-sm text-brand-ink/70">
          All {POLICIES.length} are required to register —{' '}
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
      <div className="flex items-center gap-4">
        <SubmitButton pendingText="Registering…" disabled={!allAgreed}>
          Complete registration
        </SubmitButton>
        <span className={labelClass}>{money(tuition)} tuition</span>
      </div>
    </form>
  );
}
