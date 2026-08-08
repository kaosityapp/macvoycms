'use client';

import { useActionState } from 'react';
import { updateRateCard, type ActionState } from './actions';
import { FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

interface Rate {
  id: string;
  duration_minutes: number;
  price: number;
}

export function RateCardEditor({ seasonId, rates }: { seasonId: string; rates: Rate[] }) {
  const [state, action] = useActionState<ActionState, FormData>(updateRateCard, {});

  return (
    <form action={action} className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
      <input type="hidden" name="season_id" value={seasonId} />
      <h2 className="text-lg font-semibold text-brand-pink">Rate card</h2>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-brand-ink/50">
            <th className="pb-2 font-medium">Duration (min)</th>
            <th className="pb-2 font-medium">Price ($)</th>
            <th className="pb-2 font-medium">Remove</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id}>
              <td className="py-1">
                <input type="hidden" name="existing_id" value={r.id} />
                {r.duration_minutes}
              </td>
              <td className="py-1">
                <input
                  name={`price_${r.id}`}
                  type="number"
                  step="0.01"
                  defaultValue={Number(r.price).toFixed(2)}
                  className={`${inputClass} w-28`}
                />
              </td>
              <td className="py-1">
                <input type="checkbox" name={`delete_${r.id}`} className="h-4 w-4 accent-red-600" />
              </td>
            </tr>
          ))}
          <tr className="border-t border-brand-ink/10">
            <td className="py-2">
              <input
                name="new_duration"
                type="number"
                placeholder="Add duration"
                className={`${inputClass} w-32`}
              />
            </td>
            <td className="py-2">
              <input
                name="new_price"
                type="number"
                step="0.01"
                placeholder="Price"
                className={`${inputClass} w-28`}
              />
            </td>
            <td />
          </tr>
        </tbody>
      </table>

      <SubmitButton pendingText="Saving…">Save rate card</SubmitButton>
    </form>
  );
}
