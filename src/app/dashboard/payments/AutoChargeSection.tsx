'use client';

import { useState, useTransition } from 'react';
import { setAutoCharge } from './actions';
import type { AutoChargePlan } from '@/lib/dashboard';

export function AutoChargeSection({ plans }: { plans: AutoChargePlan[] }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = plans.filter((p) => !removed.has(p.planId));
  if (visible.length === 0) return null;

  return (
    <section className="rounded-lg border border-brand-ink/10 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-pink">Automatic payments</h2>
      <ul className="mt-2 space-y-2">
        {visible.map((p) => (
          <li key={p.planId} className="flex items-center justify-between text-sm">
            <span className="text-brand-ink">
              {p.memberName} — installments are charged automatically on their due date.
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setAutoCharge(p.planId, false);
                  setRemoved((prev) => new Set(prev).add(p.planId));
                })
              }
              className="text-brand-pink hover:underline disabled:opacity-50"
            >
              Turn off
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
