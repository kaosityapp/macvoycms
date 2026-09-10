'use client';

import { useActionState } from 'react';
import { updateDancerAddon, type ActionState } from '../actions';
import { FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';
import { ADDON_OPTIONS } from '@/lib/constants/addons';
import { money } from '@/lib/format';

export function EditAddonForm({ memberId, current }: { memberId: string; current: string }) {
  const [state, action] = useActionState<ActionState, FormData>(updateDancerAddon, {});

  return (
    <div className="text-sm">
      <h3 className="font-semibold text-brand-ink">Add-ons</h3>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input type="hidden" name="member_id" value={memberId} />
        <select name="addon" defaultValue={current} className={`${inputClass} w-56`}>
          {ADDON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.amount > 0 ? ` — ${money(o.amount)}` : ''}
            </option>
          ))}
        </select>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </form>
      <p className="mt-1 text-xs text-brand-ink/50">
        Changing this adjusts their plan total by the price difference, on top of their existing
        tuition.
      </p>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
    </div>
  );
}
