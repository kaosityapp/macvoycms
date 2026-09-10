'use client';

import { useActionState } from 'react';
import { chooseFamilyPlan, type ChoosePlanResult } from './actions';
import { FormError, SubmitButton } from '@/components/ui';
import { money } from '@/lib/format';

export function ChoosePlanForm({
  planId,
  memberName,
  totalAmount,
  canChooseQuarterly,
}: {
  planId: string;
  memberName: string;
  totalAmount: number;
  canChooseQuarterly: boolean;
}) {
  const [state, action] = useActionState<ChoosePlanResult, FormData>(chooseFamilyPlan, {});
  const installment = Math.round((totalAmount / 4) * 100) / 100;

  return (
    <li className="space-y-3 px-5 py-4">
      <div>
        <div className="font-medium text-brand-ink">{memberName} — {money(totalAmount)} total</div>
        <div className="text-sm text-brand-ink/60">Approved! Choose how you&apos;d like to pay.</div>
        {!canChooseQuarterly && (
          <div className="text-xs text-brand-ink/50">
            Quarterly is only available with 2 or more weekly classes — 1 class must be paid in full.
          </div>
        )}
      </div>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-3">
        {canChooseQuarterly && (
          <form action={action}>
            <input type="hidden" name="plan_id" value={planId} />
            <input type="hidden" name="choice" value="quarterly" />
            <SubmitButton pendingText="Saving…">Quarterly — 4× {money(installment)}</SubmitButton>
          </form>
        )}
        <form action={action}>
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="choice" value="paid_in_full" />
          <SubmitButton pendingText="Saving…">Pay in full — {money(totalAmount)}</SubmitButton>
        </form>
      </div>
    </li>
  );
}
