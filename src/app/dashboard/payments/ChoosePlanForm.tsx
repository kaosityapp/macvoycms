'use client';

import { useActionState } from 'react';
import { chooseFamilyPlan, type ChoosePlanResult } from './actions';
import { FormError, SubmitButton } from '@/components/ui';
import { money, formatTime } from '@/lib/format';
import type { PlanAwaitingChoiceClass, PlanAwaitingChoiceAddon } from '@/lib/dashboard';

export function ChoosePlanForm({
  planId,
  memberName,
  totalAmount,
  canChooseQuarterly,
  classes,
  addons,
}: {
  planId: string;
  memberName: string;
  totalAmount: number;
  canChooseQuarterly: boolean;
  classes: PlanAwaitingChoiceClass[];
  addons: PlanAwaitingChoiceAddon[];
}) {
  const [state, action] = useActionState<ChoosePlanResult, FormData>(chooseFamilyPlan, {});
  const installment = Math.round((totalAmount / 4) * 100) / 100;

  return (
    <li className="space-y-3 px-5 py-4">
      <div>
        <div className="font-medium text-brand-ink">{memberName}</div>
        <div className="text-sm text-brand-ink/60">Approved! Here&apos;s what you&apos;re paying for.</div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-white/60 p-3 text-sm">
        {classes.length > 0 && (
          <div className="space-y-1">
            {classes.map((c, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3">
                <span className="text-brand-ink/80">
                  {c.name}
                  <span className="text-brand-ink/50">
                    {' '}
                    — {c.dayOfWeek} {formatTime(c.startTime)}–{formatTime(c.endTime)}
                    {c.locationName ? ` · ${c.locationName}` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        {addons.length > 0 && (
          <div className={`space-y-1 ${classes.length > 0 ? 'mt-2 border-t border-amber-200 pt-2' : ''}`}>
            {addons.map((a, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3">
                <span className="text-brand-ink/80">{a.label}</span>
                <span className="text-brand-ink/70">{money(a.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between border-t border-amber-300 pt-2">
          <span className="font-semibold text-brand-ink">Total (HST included)</span>
          <span className="text-lg font-bold text-brand-pink">{money(totalAmount)}</span>
        </div>
      </div>

      {!canChooseQuarterly && (
        <div className="text-xs text-brand-ink/50">
          Quarterly is only available with 2 or more weekly classes — 1 class must be paid in full.
        </div>
      )}
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
