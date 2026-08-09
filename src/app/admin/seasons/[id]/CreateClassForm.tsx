'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { createClass, type ActionState } from './actions';
import { Field, FormError, FormSuccess, SubmitButton, inputClass } from '@/components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};
const LEVELS = ['beginner', 'advanced', 'competitive', 'adult', 'ceili'];
const SHOES = ['soft', 'hard', 'soft-hard', 'n/a'];

/** All dates between start and end (inclusive) that fall on `dayName`. */
function candidateDates(startIso: string, endIso: string, dayName: string): string[] {
  const dow = DAY_INDEX[dayName];
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || dow == null || end < start) return [];
  const out: string[] = [];
  for (let t = start, i = 0; t <= end && i < 500; t += 86_400_000, i++) {
    const d = new Date(t);
    if (d.getUTCDay() === dow) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}
function dayNum(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}
function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function CreateClassForm({ locations }: { locations: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createClass, {});

  const [day, setDay] = useState('Monday');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState(60);
  const [hourlyRate, setHourlyRate] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const candidates = useMemo(
    () => (startDate && endDate ? candidateDates(startDate, endDate, day) : []),
    [startDate, endDate, day],
  );

  // Default: every candidate date checked. Re-runs when the range/day changes.
  useEffect(() => {
    setSelected(new Set(candidates));
  }, [candidates]);

  const toggle = (iso: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(iso) ? next.delete(iso) : next.add(iso);
      return next;
    });

  const selectedList = candidates.filter((d) => selected.has(d));
  const count = selectedList.length;
  const rate = Number(hourlyRate);
  const estTuition =
    rate > 0 && count > 0 ? Math.round(rate * (duration / 60) * count * 100) / 100 : 0;

  // Group candidates by month for display.
  const byMonth = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of candidates) {
      const key = d.slice(0, 7);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return [...m.entries()];
  }, [candidates]);

  return (
    <form action={action} className="space-y-5 rounded-lg border border-brand-ink/10 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-pink">Add a class</h2>
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class name" htmlFor="name" required>
          <input id="name" name="name" required className={inputClass} />
        </Field>
        <Field label="Location" htmlFor="location_id" required>
          <select id="location_id" name="location_id" required className={inputClass} defaultValue="">
            <option value="" disabled>Select…</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Day of week" htmlFor="day_of_week" required>
          <select id="day_of_week" name="day_of_week" required value={day} onChange={(e) => setDay(e.target.value)} className={inputClass}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" htmlFor="start_time" required>
            <input id="start_time" name="start_time" type="time" required className={inputClass} />
          </Field>
          <Field label="Duration (min)" htmlFor="duration_minutes" required>
            <input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              min={5}
              step={5}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Start date" htmlFor="start_date" required>
          <input id="start_date" name="start_date" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="End date" htmlFor="end_date" required>
          <input id="end_date" name="end_date" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Price per hour ($)" htmlFor="hourly_rate" required hint="Tuition = rate × hours × number of classes.">
          <input id="hourly_rate" name="hourly_rate" type="number" step="0.01" min={0} required value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {/* Optional descriptors */}
      <details className="rounded-md border border-brand-ink/10 p-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-pink">
          Level / shoe / ages (optional)
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Level" htmlFor="level">
            <select id="level" name="level" className={inputClass} defaultValue="beginner">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Shoe type" htmlFor="shoe_type">
            <select id="shoe_type" name="shoe_type" className={inputClass} defaultValue="soft">
              {SHOES.map((s) => <option key={s} value={s}>{s}</option>)}
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
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="is_private" className="h-4 w-4 accent-brand-pink" />
            Individual / private lesson
          </label>
        </div>
      </details>

      {/* Calendar: candidate dates, all checked, deselect holidays */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-brand-ink">Class dates</h3>
          <span className="text-sm text-brand-ink/60">
            {count} class{count === 1 ? '' : 'es'}
            {estTuition > 0 && ` · est. ${money(estTuition)} tuition`}
          </span>
        </div>
        {candidates.length === 0 ? (
          <p className="rounded-md bg-brand-ink/[0.03] px-3 py-2 text-sm text-brand-ink/60">
            Set a start date, end date, and day of week to see every {day} in the range — then
            uncheck any holiday weeks.
          </p>
        ) : (
          <div className="space-y-3">
            {byMonth.map(([key, dates]) => (
              <div key={key}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-ink/50">
                  {monthLabel(dates[0])}
                </div>
                <div className="flex flex-wrap gap-2">
                  {dates.map((d) => {
                    const on = selected.has(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggle(d)}
                        className={`rounded-md border px-2.5 py-1 text-sm transition ${
                          on
                            ? 'border-brand-pink bg-brand-pink text-white'
                            : 'border-brand-ink/20 bg-white text-brand-ink/50 line-through'
                        }`}
                      >
                        {dayNum(d)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden fields carrying the selected dates + count */}
      {selectedList.map((d) => (
        <input key={d} type="hidden" name="session_dates" value={d} />
      ))}
      <input type="hidden" name="total_sessions" value={count} />

      <SubmitButton pendingText="Adding…">Add class &amp; {count} dates</SubmitButton>
    </form>
  );
}
