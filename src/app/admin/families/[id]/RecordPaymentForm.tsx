'use client';

import { useActionState } from 'react';
import { recordManualPayment, type ActionState } from '../actions';
import { FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';
import { todayIso } from '@/lib/billing/dueDates';

const METHODS = [
  { value: 'e-transfer', label: 'E-transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export function RecordPaymentForm({ memberId }: { memberId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(recordManualPayment, {});

  return (
    <details className="rounded-md border border-brand-ink/10 p-3">
      <summary className="cursor-pointer text-sm font-medium text-brand-pink">
        Record a payment
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="member_id" value={memberId} />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />

        <div className="flex flex-wrap items-center gap-2">
          <input
            name="amount"
            type="number"
            step="0.01"
            placeholder="Amount"
            required
            className={`${inputClass} w-28`}
          />
          <input
            name="date"
            type="date"
            defaultValue={todayIso()}
            required
            className={`${inputClass} w-44`}
          />
          <select name="method" defaultValue="e-transfer" className={`${inputClass} w-36`}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <input name="note" placeholder="Note (optional)" className={inputClass} />

        <p className="text-xs text-brand-ink/50">
          Use this for payments received outside Helcim (e-transfer, cash, cheque). It&apos;s added
          straight to this dancer&apos;s payment history.
        </p>
        <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
      </form>
    </details>
  );
}
