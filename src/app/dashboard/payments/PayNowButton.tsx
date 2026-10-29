'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startPayment, confirmPaymentClientSide, payWithFamilySavedMethod } from './actions';
import { money } from '@/lib/format';
import type { FamilySavedMethod } from '@/lib/dashboard';

const SCRIPT_SRC = 'https://secure.helcim.app/helcim-pay/services/start.js';

declare global {
  interface Window {
    appendHelcimPayIframe?: (token: string, allowExit?: boolean) => void;
  }
}

function loadHelcimScript(): Promise<void> {
  if (window.appendHelcimPayIframe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment form.'));
    document.body.appendChild(script);
  });
}

type Phase = 'idle' | 'starting' | 'open' | 'confirming' | 'done' | 'settling' | 'error';

export function PayNowButton({
  memberId,
  paymentPlanId,
  installmentIndex,
  amount,
  savedMethod,
  feePercent,
}: {
  memberId: string;
  paymentPlanId: string;
  installmentIndex: number;
  amount: number;
  /** The family's card/bank already on file, offered when this dancer's plan
   *  has none of its own. Null when the plan has one, or the family doesn't. */
  savedMethod: FamilySavedMethod | null;
  feePercent: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  // Default to the card the family already uses — re-entering it is the
  // exception (a parent paying their own class on a different card).
  const [useSaved, setUseSaved] = useState(true);
  const listenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const offerSaved = savedMethod !== null;
  const savedLabel = savedMethod
    ? `Saved ${savedMethod.kind === 'card' ? 'card' : 'bank account'} (used for ${savedMethod.memberFirstName})`
    : '';

  useEffect(() => {
    return () => {
      if (listenerRef.current) window.removeEventListener('message', listenerRef.current);
    };
  }, []);

  async function handlePaySaved() {
    setPhase('confirming');
    setError(null);
    const result = await payWithFamilySavedMethod({ paymentPlanId, installmentIndex });
    if (result.error) {
      setError(result.error);
      setPhase('error');
      return;
    }
    setPhase(result.settling ? 'settling' : 'done');
    setTimeout(() => router.refresh(), 1200);
  }

  async function handlePay() {
    if (offerSaved && useSaved) return handlePaySaved();
    setPhase('starting');
    setError(null);

    // Always saved — recurring installment charges (and Debbie's failed-payment
    // retry) both depend on having a stored card/bank token on file.
    const result = await startPayment({ memberId, paymentPlanId, installmentIndex, amount, saveCard: true });
    if (result.error || !result.checkoutToken || !result.reference) {
      setError(result.error ?? 'Could not start the payment.');
      setPhase('error');
      return;
    }
    const { checkoutToken, reference } = result;

    try {
      await loadHelcimScript();
    } catch {
      setError('Could not load the payment form. Check your connection and try again.');
      setPhase('error');
      return;
    }

    const handler = async (event: MessageEvent) => {
      if (event.data?.eventName !== `helcim-pay-js-${checkoutToken}`) return;
      const { eventStatus, eventMessage } = event.data ?? {};

      if (eventStatus === 'SUCCESS') {
        setPhase('confirming');
        const confirmed = await confirmPaymentClientSide(reference, eventMessage);
        if (confirmed.ok) {
          setPhase(confirmed.settling ? 'settling' : 'done');
          setTimeout(() => router.refresh(), 1200);
        } else {
          setError(confirmed.error ?? 'Payment could not be verified.');
          setPhase('error');
        }
        window.removeEventListener('message', handler);
      } else if (eventStatus === 'ABORTED') {
        setError('Payment was declined or cancelled.');
        setPhase('error');
        window.removeEventListener('message', handler);
      } else if (eventStatus === 'HIDE') {
        setPhase((p) => (p === 'open' ? 'idle' : p));
      }
    };
    listenerRef.current = handler;
    window.addEventListener('message', handler);

    setPhase('open');
    window.appendHelcimPayIframe?.(checkoutToken, true);
  }

  if (phase === 'done') {
    return <span className="text-sm font-semibold text-green-700">Payment received ✓</span>;
  }
  if (phase === 'settling') {
    return (
      <span className="text-sm font-semibold text-brand-pink">
        Bank withdrawal started — settlement can take a few days; we&apos;ll email a receipt once confirmed.
      </span>
    );
  }

  const busy = phase === 'starting' || phase === 'open' || phase === 'confirming';

  return (
    <div className="flex flex-col items-end gap-1">
      {offerSaved && (
        <fieldset className="flex flex-col items-start gap-1 text-sm text-brand-ink" disabled={busy}>
          <legend className="sr-only">Payment method</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`method-${paymentPlanId}-${installmentIndex}`}
              checked={useSaved}
              onChange={() => setUseSaved(true)}
              className="accent-brand-pink"
            />
            {savedLabel}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`method-${paymentPlanId}-${installmentIndex}`}
              checked={!useSaved}
              onChange={() => setUseSaved(false)}
              className="accent-brand-pink"
            />
            Enter a new card or bank account
          </label>
        </fieldset>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePay}
          disabled={busy}
          className="rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === 'starting'
            ? 'Loading…'
            : phase === 'confirming'
              ? 'Confirming…'
              : `Pay ${money(amount)}`}
        </button>
      </div>
      <span className="text-xs text-brand-ink/50">
        {offerSaved && useSaved
          ? savedMethod?.kind === 'card'
            ? `Charged now plus the ${feePercent}% card fee; future installments go on the same card automatically.`
            : 'Withdrawn now; future installments come from the same account automatically.'
          : 'Your card is saved on file for future installments.'}
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
