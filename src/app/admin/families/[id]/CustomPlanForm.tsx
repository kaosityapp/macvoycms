'use client';

import { useActionState, useState } from 'react';
import { createCustomPlan, type ActionState } from '../actions';
import { FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

export function CustomPlanForm({
  memberId,
  familyId,
  defaultOpen = false,
}: {
  memberId: string;
  familyId: string;
  defaultOpen?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(createCustomPlan, {});
  const [rows, setRows] = useState<number[]>([0]);

  return (
    <details className="rounded-md border border-brand-ink/10 p-3" open={defaultOpen}>
      <summary className="cursor-pointer text-sm font-medium text-brand-pink">
        {defaultOpen ? 'Approve — set the Fall Sessions payment schedule' : 'Create custom payment plan'}
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="member_id" value={memberId} />
        <input type="hidden" name="family_id" value={familyId} />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />

        <div className="space-y-2">
          {rows.map((rowId) => (
            <div key={rowId} className="flex items-center gap-2">
              <input name="installment_date" type="date" className={`${inputClass} w-44`} />
              <input
                name="installment_amount"
                type="number"
                step="0.01"
                placeholder="Amount"
                className={`${inputClass} w-32`}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((r) => r.filter((id) => id !== rowId))}
                  className="text-sm text-red-600 hover:underline"
                >
                  remove
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows((r) => [...r, (r.at(-1) ?? 0) + 1])}
          className="text-sm text-brand-pink hover:underline"
        >
          + Add installment
        </button>

        <div className="flex items-center gap-2">
          <label className="text-sm text-brand-ink/70">Total (optional):</label>
          <input name="total_amount" type="number" step="0.01" placeholder="Auto-sum" className={`${inputClass} w-32`} />
        </div>

        <p className="text-xs text-brand-ink/50">
          Add one row per Fall Sessions payment (e.g. each month&apos;s due date and amount). This
          supersedes the dancer&apos;s current active plan and, for a dancer awaiting pricing,
          approves them and emails the family their schedule. It does not charge anything on its
          own.
        </p>
        <SubmitButton pendingText="Creating…">Create custom plan</SubmitButton>
      </form>
    </details>
  );
}
