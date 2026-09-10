'use client';

import { useActionState } from 'react';
import { approveWithTotalPrice, type ActionState } from '../actions';
import { FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

export function ApproveWithTotalForm({ memberId }: { memberId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(approveWithTotalPrice, {});

  return (
    <details className="rounded-md border border-brand-pink/30 bg-brand-pink/5 p-3" open>
      <summary className="cursor-pointer text-sm font-medium text-brand-pink">
        Approve with a total price (family chooses their plan)
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="member_id" value={memberId} />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <div className="flex items-center gap-2">
          <label className="text-sm text-brand-ink/70">Fall Sessions total price ($):</label>
          <input name="total_amount" type="number" step="0.01" min="0" required className={`${inputClass} w-32`} />
        </div>
        <p className="text-xs text-brand-ink/50">
          Sets their Fall Sessions tuition total and emails them to log in and choose monthly
          payments vs paid-in-full themselves — no need to build out installments here. Use
          &quot;Create custom payment plan&quot; below instead if you need to set exact
          installment dates/amounts yourself.
        </p>
        <SubmitButton pendingText="Approving…">Approve &amp; set price</SubmitButton>
      </form>
    </details>
  );
}
