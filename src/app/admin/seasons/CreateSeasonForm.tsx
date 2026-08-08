'use client';

import { useActionState } from 'react';
import { createSeason, type ActionState } from './actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

export function CreateSeasonForm() {
  const [state, action] = useActionState<ActionState, FormData>(createSeason, {});

  return (
    <form action={action} className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-pink">New season</h2>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor="name" required hint="e.g. 2027–2028">
          <input id="name" name="name" required className={inputClass} />
        </Field>
        <Field label="Start date" htmlFor="startDate" required>
          <input id="startDate" name="startDate" type="date" required className={inputClass} />
        </Field>
        <Field label="End date" htmlFor="endDate" required>
          <input id="endDate" name="endDate" type="date" required className={inputClass} />
        </Field>
      </div>
      <p className="text-xs text-brand-ink/50">
        A default rate card (30/60/75/90/120 min) is created automatically — edit it on the season
        page.
      </p>
      <SubmitButton pendingText="Creating…">Create season</SubmitButton>
    </form>
  );
}
