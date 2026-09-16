'use client';

import { useState, useTransition } from 'react';
import { requestAutoChargeCancellation } from './actions';
import type { AutoChargePlan } from '@/lib/dashboard';

// feePercent comes from the server — HELCIM_CARD_FEE_PERCENT is not a
// NEXT_PUBLIC_ var, so reading it here would silently fall back to the default.
export function AutoChargeSection({ plans, feePercent }: { plans: AutoChargePlan[]; feePercent: number }) {
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  if (plans.length === 0) return null;

  return (
    <section className="rounded-lg border border-brand-ink/10 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-pink">Automatic payments</h2>
      <ul className="mt-2 space-y-2">
        {plans.map((p) => {
          const wasRequested = requested.has(p.planId);
          return (
            <li key={p.planId} className="flex items-center justify-between text-sm">
              <span className="text-brand-ink">
                {p.memberName} — installments are charged automatically on their due date.
                {' '}
                {/* A card pays the processing fee here exactly as it does at
                    checkout. There's no payment modal on an automatic charge
                    to say so, so it has to be said here. */}
                <span className="text-brand-ink/60">
                  A saved card is charged the installment plus the {feePercent}% card
                  processing fee; a saved bank account has no fee.
                </span>
              </span>
              {wasRequested ? (
                <span className="text-brand-ink/50">Cancellation requested — Debbie will follow up.</span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await requestAutoChargeCancellation(p.planId);
                      setRequested((prev) => new Set(prev).add(p.planId));
                    })
                  }
                  className="text-brand-pink hover:underline disabled:opacity-50"
                >
                  Request cancellation
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
