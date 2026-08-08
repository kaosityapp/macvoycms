'use client';

import { useActionState } from 'react';
import { updateClass, type ActionState } from './actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEVELS = ['beginner', 'advanced', 'competitive', 'adult', 'ceili'];
const SHOES = ['soft', 'hard', 'soft-hard', 'n/a'];

interface ClassData {
  id: string;
  season_id: string;
  location_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  name: string;
  level: string;
  shoe_type: string;
  age_min: number | null;
  age_max: number | null;
  is_private: boolean;
}

export function EditClassForm({
  data,
  locations,
}: {
  data: ClassData;
  locations: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(updateClass, {});
  const t = (v: string) => v.slice(0, 5); // 'HH:MM:SS' → 'HH:MM' for <input type=time>

  return (
    <form action={action} className="space-y-4 rounded-lg border border-brand-ink/10 bg-white p-5">
      <input type="hidden" name="class_id" value={data.id} />
      <input type="hidden" name="season_id" value={data.season_id} />
      <h2 className="text-lg font-semibold text-brand-pink">Class template</h2>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class name" htmlFor="name" required>
          <input id="name" name="name" required defaultValue={data.name} className={inputClass} />
        </Field>
        <Field label="Location" htmlFor="location_id" required>
          <select id="location_id" name="location_id" required defaultValue={data.location_id} className={inputClass}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day" htmlFor="day_of_week" required>
          <select id="day_of_week" name="day_of_week" required defaultValue={data.day_of_week} className={inputClass}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" htmlFor="start_time" required>
            <input id="start_time" name="start_time" type="time" required defaultValue={t(data.start_time)} className={inputClass} />
          </Field>
          <Field label="End" htmlFor="end_time" required>
            <input id="end_time" name="end_time" type="time" required defaultValue={t(data.end_time)} className={inputClass} />
          </Field>
        </div>
        <Field label="Level" htmlFor="level" required>
          <select id="level" name="level" required defaultValue={data.level} className={inputClass}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shoe type" htmlFor="shoe_type" required>
          <select id="shoe_type" name="shoe_type" required defaultValue={data.shoe_type} className={inputClass}>
            {SHOES.map((sh) => (
              <option key={sh} value={sh}>
                {sh}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min age" htmlFor="age_min">
            <input id="age_min" name="age_min" type="number" defaultValue={data.age_min ?? ''} className={inputClass} />
          </Field>
          <Field label="Max age" htmlFor="age_max">
            <input id="age_max" name="age_max" type="number" defaultValue={data.age_max ?? ''} className={inputClass} />
          </Field>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_private" defaultChecked={data.is_private} className="h-4 w-4 accent-brand-pink" />
        Individual / private lesson
      </label>

      <div className="rounded-md bg-brand-pink/5 p-3">
        <Field
          label="Apply to sessions from date (optional)"
          htmlFor="apply_from"
          hint="Leave blank to change the template only. Set a date to regenerate this class's sessions from that day onward — past sessions are never affected."
        >
          <input id="apply_from" name="apply_from" type="date" className={inputClass} />
        </Field>
      </div>

      <SubmitButton pendingText="Saving…">Save class</SubmitButton>
    </form>
  );
}
