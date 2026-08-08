import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/billing/dueDates';
import { formatDateLong, formatTime } from '@/lib/format';
import { SubmitButton, inputClass } from '@/components/ui';
import { EditClassForm } from './EditClassForm';
import { updateSession } from './actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['scheduled', 'cancelled', 'rescheduled'];

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from('classes')
    .select(
      'id, season_id, location_id, day_of_week, start_time, end_time, name, level, shoe_type, age_min, age_max, is_private, season:seasons(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!cls) notFound();

  const [locationsRes, sessionsRes] = await Promise.all([
    supabase.from('locations').select('id, name').order('name'),
    supabase
      .from('class_sessions')
      .select('id, session_date, start_time, end_time, status, note')
      .eq('class_id', id)
      .gte('session_date', todayIso())
      .order('session_date', { ascending: true })
      .limit(60),
  ]);

  const sessions = (sessionsRes.data ?? []) as any[];

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/admin/seasons/${cls.season_id}`} className="text-sm text-brand-pink hover:underline">
          ← {(cls as any).season?.name ?? 'Season'}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-pink">{cls.name}</h1>
      </div>

      <EditClassForm data={cls as any} locations={(locationsRes.data ?? []) as any[]} />

      {/* Sessions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Upcoming sessions</h2>
        <p className="text-sm text-brand-ink/70">
          Cancel a specific week (e.g. a holiday) or add a note without changing the template.
        </p>
        <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {sessions.map((s) => (
            <form
              key={s.id}
              action={updateSession}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <input type="hidden" name="session_id" value={s.id} />
              <input type="hidden" name="class_id" value={id} />
              <div className="min-w-[12rem] text-sm">
                <div className="font-medium text-brand-ink">{formatDateLong(s.session_date)}</div>
                <div className="text-brand-ink/60">
                  {formatTime(s.start_time)}–{formatTime(s.end_time)}
                </div>
              </div>
              <select name="status" defaultValue={s.status} className={`${inputClass} w-40`}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <input
                name="note"
                defaultValue={s.note ?? ''}
                placeholder="Note (optional)"
                className={`${inputClass} flex-1 min-w-[10rem]`}
              />
              <SubmitButton pendingText="Saving…">Save</SubmitButton>
            </form>
          ))}
          {sessions.length === 0 && (
            <p className="px-4 py-4 text-brand-ink/60">
              No upcoming sessions. Generate them from the season page.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
