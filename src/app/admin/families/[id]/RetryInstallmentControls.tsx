'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { retryInstallmentNow, pushInstallmentDueDate, type ActionState } from '../actions';
import { FormError, FormSuccess } from '@/components/ui';

function RetryButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-brand-pink px-2 py-0.5 text-xs font-semibold text-brand-pink hover:bg-brand-pink/5 disabled:opacity-50"
    >
      {pending ? 'Charging…' : label}
    </button>
  );
}

const PUSH_OPTIONS = [
  { days: 1, label: '+1 day' },
  { days: 2, label: '+2 days' },
  { days: 7, label: '+1 week' },
];

export function RetryInstallmentControls({
  memberId,
  planId,
  installmentIndex,
  hasPaymentMethod,
  chargeAmount,
  feeAmount,
}: {
  memberId: string;
  planId: string;
  installmentIndex: number;
  hasPaymentMethod: boolean;
  /** What actually reaches the card: the installment plus the card fee. */
  chargeAmount: string;
  feeAmount: string;
}) {
  const [retryState, retryAction] = useActionState<ActionState, FormData>(retryInstallmentNow, {});
  const [pushState, pushAction] = useActionState<ActionState, FormData>(pushInstallmentDueDate, {});

  return (
    <span className="flex flex-wrap items-center gap-2">
      {hasPaymentMethod ? (
        <form action={retryAction}>
          <input type="hidden" name="member_id" value={memberId} />
          <input type="hidden" name="plan_id" value={planId} />
          {/* The schedule line shows the installment; the card is charged the
              fee on top, so the button says the number that will actually be
              taken rather than leaving it to be remembered. */}
          <RetryButton label={`Charge ${chargeAmount}`} />
          <span className="ml-2 text-xs text-brand-ink/50">incl. {feeAmount} card fee</span>
        </form>
      ) : (
        // Say why there's nothing to click. Silently hiding it read as "the
        // button disappeared" when a plan change dropped the saved card.
        <span className="text-xs text-brand-ink/50">
          No saved card — the family can pay from their own Payments page.
        </span>
      )}
      <span className="text-xs text-brand-ink/40">give more time:</span>
      {PUSH_OPTIONS.map((opt) => (
        <form action={pushAction} key={opt.days}>
          <input type="hidden" name="member_id" value={memberId} />
          <input type="hidden" name="plan_id" value={planId} />
          <input type="hidden" name="installment_index" value={installmentIndex} />
          <input type="hidden" name="days" value={opt.days} />
          <button type="submit" className="text-xs text-brand-pink hover:underline">
            {opt.label}
          </button>
        </form>
      ))}
      {(retryState.error || retryState.success) && (
        <span className="w-full text-xs">
          <FormError message={retryState.error} />
          <FormSuccess message={retryState.success} />
        </span>
      )}
      {(pushState.error || pushState.success) && (
        <span className="w-full text-xs">
          <FormError message={pushState.error} />
          <FormSuccess message={pushState.success} />
        </span>
      )}
    </span>
  );
}
