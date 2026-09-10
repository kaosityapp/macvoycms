'use client';

import { useActionState, useState } from 'react';
import {
  updatePendingRegistration,
  deletePendingRegistration,
  addPendingPayment,
  removePendingPayment,
  type ActionState,
} from './actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';
import { formatTime, formatDateShort, money } from '@/lib/format';
import { todayIso } from '@/lib/billing/dueDates';
import { ADDON_OPTIONS } from '@/lib/constants/addons';

interface ClassItem {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  name: string;
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
  class_ids?: string[];
  plan_type?: string;
  installment_schedule?: { date: string; amount: number }[];
  payments_received?: { date: string; amount: number; method: string; note?: string }[];
  addon?: string;
}

interface PendingInfo {
  parent1_name: string | null;
  parent1_phone: string | null;
  parent2_name: string | null;
  parent2_phone: string | null;
  parent2_email: string | null;
}

const PLAN_TYPES = [
  { value: 'custom', label: 'Custom' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'paid_in_full', label: 'Paid in full' },
];

export function EditPendingForm({
  pendingId,
  pending,
  dancers,
  groups,
}: {
  pendingId: string;
  pending: PendingInfo;
  dancers: DancerPrefill[];
  groups: Group[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(updatePendingRegistration, {});

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="pending_id" value={pendingId} />
      <input type="hidden" name="dancerCount" value={dancers.length} />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      {/* Account holder */}
      <section className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-pink">Account holder</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parent 1 name" htmlFor="parent1_name" required>
            <input
              id="parent1_name"
              name="parent1_name"
              required
              defaultValue={pending.parent1_name ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 1 phone" htmlFor="parent1_phone">
            <input
              id="parent1_phone"
              name="parent1_phone"
              defaultValue={pending.parent1_phone ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 2 name" htmlFor="parent2_name">
            <input
              id="parent2_name"
              name="parent2_name"
              defaultValue={pending.parent2_name ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 2 phone" htmlFor="parent2_phone">
            <input
              id="parent2_phone"
              name="parent2_phone"
              defaultValue={pending.parent2_phone ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Parent 2 email" htmlFor="parent2_email">
            <input
              id="parent2_email"
              name="parent2_email"
              type="email"
              defaultValue={pending.parent2_email ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {/* Dancers */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-brand-pink">Dancer(s)</h2>
        {dancers.map((d, i) => (
          <DancerEditFields key={i} index={i} dancer={d} groups={groups} pendingId={pendingId} />
        ))}
      </section>

      <div className="flex items-center justify-between">
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
      </div>

      <details className="rounded-md border border-red-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-red-700">
          Delete this pending registration
        </summary>
        <form action={deletePendingRegistration} className="mt-3 space-y-2">
          <input type="hidden" name="pending_id" value={pendingId} />
          <p className="text-xs text-brand-ink/60">
            Removes it entirely — use if this was imported by mistake. The family won&apos;t see a
            pre-filled registration anymore.
          </p>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete permanently
          </button>
        </form>
      </details>
    </form>
  );
}

function DancerEditFields({
  index,
  dancer,
  groups,
  pendingId,
}: {
  index: number;
  dancer: DancerPrefill;
  groups: Group[];
  pendingId: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(dancer.class_ids ?? []));
  const existingInstallments = dancer.installment_schedule ?? [];
  const [rows, setRows] = useState<number[]>(
    existingInstallments.length > 0 ? existingInstallments.map((_, idx) => idx) : [0],
  );

  function toggleClass(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
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
          <input
            id={`gender_${index}`}
            name={`gender_${index}`}
            defaultValue={dancer.gender ?? ''}
            className={inputClass}
          />
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

      {/* Classes — admin can edit, since fixing this IS the "contact the school" path */}
      <div>
        <h4 className="text-sm font-semibold text-brand-ink/80">Classes</h4>
        <div className="mt-2 space-y-3">
          {groups.map((group) => (
            <div key={group.location.id}>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
                {group.location.name}
              </p>
              <ul className="mt-1 divide-y divide-brand-ink/10 rounded-md border border-brand-ink/10">
                {group.classes.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      name={`classIds_${index}`}
                      value={c.id}
                      checked={selected.has(c.id)}
                      onChange={() => toggleClass(c.id)}
                      className="mt-0.5 h-4 w-4 accent-brand-pink"
                    />
                    <span className="text-sm">
                      {c.name} — {c.day_of_week} {formatTime(c.start_time)}–{formatTime(c.end_time)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Add-ons — in case the family didn't pick (or picked the wrong) ones at registration */}
      <Field label="Add-ons" htmlFor={`addon_${index}`}>
        <select
          id={`addon_${index}`}
          name={`addon_${index}`}
          defaultValue={dancer.addon ?? 'none'}
          className={`${inputClass} w-64`}
        >
          {ADDON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.amount > 0 ? ` — ${money(o.amount)}` : ''}
            </option>
          ))}
        </select>
      </Field>

      {/* Payment plan */}
      <div>
        <h4 className="text-sm font-semibold text-brand-ink/80">Payment plan</h4>
        <Field label="Plan type" htmlFor={`planType_${index}`}>
          <select
            id={`planType_${index}`}
            name={`planType_${index}`}
            defaultValue={dancer.plan_type ?? 'custom'}
            className={`${inputClass} w-48`}
          >
            {PLAN_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-2 space-y-2">
          {rows.map((rowKey, i) => (
            <div key={rowKey} className="flex items-center gap-2">
              <input
                name={`instDate_${index}`}
                type="date"
                defaultValue={existingInstallments[i]?.date ?? ''}
                className={`${inputClass} w-44`}
              />
              <input
                name={`instAmount_${index}`}
                type="number"
                step="0.01"
                placeholder="Amount"
                defaultValue={existingInstallments[i]?.amount ?? ''}
                className={`${inputClass} w-32`}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((k) => k !== rowKey))}
                  className="text-sm text-red-600 hover:underline"
                >
                  remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRows((r) => [...r, (r.at(-1) ?? 0) + 1])}
            className="text-sm text-brand-pink hover:underline"
          >
            + Add installment
          </button>
        </div>
        <p className="mt-1 text-xs text-brand-ink/50">Total is the sum of the installments above.</p>
      </div>

      {/* Payment history — payments received before registration is confirmed */}
      <PendingPaymentHistory pendingId={pendingId} dancerIndex={index} payments={dancer.payments_received ?? []} />
    </div>
  );
}

function PendingPaymentHistory({
  pendingId,
  dancerIndex,
  payments,
}: {
  pendingId: string;
  dancerIndex: number;
  payments: { date: string; amount: number; method: string; note?: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(addPendingPayment, {});

  return (
    <div>
      <h4 className="text-sm font-semibold text-brand-ink/80">Payment history</h4>
      {payments.length === 0 ? (
        <p className="mt-1 text-xs text-brand-ink/50">No payments received yet.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {payments.map((p, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-brand-ink">
                {money(p.amount)} — {formatDateShort(p.date)}{' '}
                <span className="capitalize text-brand-ink/50">· {p.method}</span>
                {p.note && <span className="text-brand-ink/40"> — {p.note}</span>}
              </span>
              <form action={removePendingPayment}>
                <input type="hidden" name="pending_id" value={pendingId} />
                <input type="hidden" name="dancer_index" value={dancerIndex} />
                <input type="hidden" name="payment_index" value={i} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="pending_id" value={pendingId} />
        <input type="hidden" name="dancer_index" value={dancerIndex} />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <input name="amount" type="number" step="0.01" placeholder="Amount" required className={`${inputClass} w-24`} />
        <input name="date" type="date" defaultValue={todayIso()} required className={`${inputClass} w-40`} />
        <select name="method" defaultValue="e-transfer" className={`${inputClass} w-32`}>
          <option value="e-transfer">E-transfer</option>
          <option value="cash">Cash</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </select>
        <input name="note" placeholder="Note (optional)" className={`${inputClass} w-40`} />
        <SubmitButton pendingText="Adding…">Add</SubmitButton>
      </form>
    </div>
  );
}
