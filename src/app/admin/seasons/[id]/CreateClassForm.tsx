'use client';

import { useActionState } from 'react';
import { createClass, type ActionState } from './actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEVELS = ['beginner', 'advanced', 'competitive', 'adult', 'ceili'];
const SHOES = ['soft', 'hard', 'soft-hard', 'n/a'];

export function CreateClassForm({ locations }: { locations: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createClass, {});

  return (
    <form
      action={action}
      className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5"
    >
      <h2 className="text-lg font-semibold text-brand-pink">Add a class</h2>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class name" htmlFor="name" required>
          <input id="name" name="name" required className={inputClass} />
        </Field>
        <Field label="Location" htmlFor="location_id" required>
          <select id="location_id" name="location_id" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day" htmlFor="day_of_week" required>
          <select id="day_of_week" name="day_of_week" required className={inputClass} defaultValue="Monday">
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" htmlFor="start_time" required>
            <input id="start_time" name="start_time" type="time" required className={inputClass} />
          </Field>
          <Field label="End" htmlFor="end_time" required>
            <input id="end_time" name="end_time" type="time" required className={inputClass} />
          </Field>
        </div>
        <Field label="Level" htmlFor="level" required>
          <select id="level" name="level" required className={inputClass} defaultValue="beginner">
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shoe type" htmlFor="shoe_type" required>
          <select id="shoe_type" name="shoe_type" required className={inputClass} defaultValue="soft">
            {SHOES.map((sh) => (
              <option key={sh} value={sh}>
                {sh}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min age" htmlFor="age_min">
            <input id="age_min" name="age_min" type="number" className={inputClass} />
          </Field>
          <Field label="Max age" htmlFor="age_max">
            <input id="age_max" name="age_max" type="number" className={inputClass} />
          </Field>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_private" className="h-4 w-4 accent-brand-pink" />
        Individual / private lesson
      </label>

      <SubmitButton pendingText="Adding…">Add class</SubmitButton>
    </form>
  );
}
