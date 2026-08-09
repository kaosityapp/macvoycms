'use client';

import { useActionState } from 'react';
import { importClasses, type ActionState } from './actions';
import { FormError, FormSuccess, SubmitButton } from '@/components/ui';

const TEMPLATE =
  'name,location,day_of_week,start_date,end_date,start_time,duration_minutes,hourly_rate,level,shoe_type,age_min,age_max\n' +
  'Beginner Soft Shoe,Pickering,Monday,2026-09-08,2027-06-28,17:30,30,12,beginner,soft,3,6\n' +
  'Advanced Hard Shoe,Mississauga,Tuesday,2026-09-08,2027-06-28,20:00,60,20,advanced,hard,9,\n';

export function ImportClassesForm({ seasonId }: { seasonId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(importClasses, {});
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

  return (
    <details className="rounded-lg border border-brand-ink/10 bg-white p-5">
      <summary className="cursor-pointer text-lg font-semibold text-brand-pink">
        Import classes (CSV)
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="season_id" value={seasonId} />
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <p className="text-sm text-brand-ink/70">
          One row per class. Required columns:{' '}
          <code className="text-xs">
            name, location, day_of_week, start_date, end_date, start_time, duration_minutes,
            hourly_rate
          </code>
          . Optional: <code className="text-xs">level, shoe_type, age_min, age_max</code>. Dates as
          YYYY-MM-DD, time as HH:MM (24-hour). A session is created for every matching weekday in the
          range — trim holiday weeks afterward on each class.
        </p>
        <a
          href={templateHref}
          download="macvoy-classes-template.csv"
          className="inline-block text-sm text-brand-pink hover:underline"
        >
          ↓ Download template
        </a>
        <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
        <SubmitButton pendingText="Importing…">Import CSV</SubmitButton>
      </form>
    </details>
  );
}
