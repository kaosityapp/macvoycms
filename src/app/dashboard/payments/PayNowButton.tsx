'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startPayment, confirmPaymentClientSide } from './actions';
import { money } from '@/lib/format';

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

type Phase = 'idle' | 'starting' | 'open' | 'confirming' | 'done' | 'error';

export function PayNowButton({
  memberId,
  paymentPlanId,
  installmentIndex,
  amount,
}: {
  memberId: string;
  paymentPlanId: string;
  installmentIndex: number;
  amount: number;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const listenerRef = useRef<((e: MessageEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (listenerRef.current) window.removeEventListener('message', listenerRef.current);
    };
  }, []);

  async function handlePay() {
    setPhase('starting');
    setError(null);

    const result = await startPayment({ memberId, paymentPlanId, installmentIndex, amount, saveCard });
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
          setPhase('done');
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

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-brand-ink/60">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={(e) => setSaveCard(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand-pink"
          />
          Save card for automatic payments
        </label>
        <button
          type="button"
          onClick={handlePay}
          disabled={phase === 'starting' || phase === 'open' || phase === 'confirming'}
          className="rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === 'starting'
            ? 'Loading…'
            : phase === 'confirming'
              ? 'Confirming…'
              : `Pay ${money(amount)}`}
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
