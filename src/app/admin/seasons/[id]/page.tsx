import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDateLong, formatTime } from '@/lib/format';
import { SubmitButton, inputClass } from '@/components/ui';
import { RateCardEditor } from './RateCardEditor';
import { CreateClassForm } from './CreateClassForm';
import { regenerateSessions } from './actions';

export const dynamic = 'force-dynamic';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default async function SeasonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: season } = await supabase
    .from('seasons')
    .select('id, name, start_date, end_date')
    .eq('id', id)
    .maybeSingle();
  if (!season) notFound();

  const [ratesRes, classesRes, locationsRes, sessionCountRes] = await Promise.all([
    supabase.from('rate_card').select('id, duration_minutes, price').eq('season_id', id).order('duration_minutes'),
    supabase
      .from('classes')
      .select('id, name, day_of_week, start_time, end_time, level, location:locations(name)')
      .eq('season_id', id),
    supabase.from('locations').select('id, name').order('name'),
    supabase
      .from('class_sessions')
      .select('id, classes!inner(season_id)', { count: 'exact', head: true })
      .eq('classes.season_id', id),
  ]);

  const classes = ((classesRes.data ?? []) as any[]).sort(
    (a, b) =>
      DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week) ||
      a.start_time.localeCompare(b.start_time),
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/seasons" className="text-sm text-brand-pink hover:underline">
          ← All seasons
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-pink">{season.name}</h1>
        <p className="text-sm text-brand-ink/60">
          {formatDateLong(season.start_date)} – {formatDateLong(season.end_date)}
        </p>
      </div>

      <RateCardEditor
        seasonId={season.id}
        rates={(ratesRes.data ?? []) as any[]}
      />

      {/* Classes */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Classes</h2>
        <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/classes/${c.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-brand-pink/5"
              >
                <div>
                  <div className="font-medium text-brand-ink">{c.name}</div>
                  <div className="text-sm text-brand-ink/60">
                    {c.day_of_week} {formatTime(c.start_time)}–{formatTime(c.end_time)} ·{' '}
                    {c.location?.name} · {c.level}
                  </div>
                </div>
                <span className="text-sm text-brand-ink/40">edit →</span>
              </Link>
            </li>
          ))}
          {classes.length === 0 && (
            <li className="px-5 py-4 text-brand-ink/60">No classes yet.</li>
          )}
        </ul>
      </section>

      <CreateClassForm locations={(locationsRes.data ?? []) as any[]} />

      {/* Sessions */}
      <section className="space-y-3 rounded-lg border border-brand-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-brand-pink">Calendar sessions</h2>
        <p className="text-sm text-brand-ink/70">
          {sessionCountRes.count ?? 0} sessions generated for this season. Run this after adding or
          changing classes. Leave the date blank to (re)generate the whole season, or set a date to
          only regenerate from that day onward — past sessions are never touched.
        </p>
        <form action={regenerateSessions} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="season_id" value={season.id} />
          <div>
            <label htmlFor="from_date" className="block text-sm font-medium text-brand-ink">
              From date (optional)
            </label>
            <input id="from_date" name="from_date" type="date" className={inputClass} />
          </div>
          <SubmitButton pendingText="Generating…">Generate / refresh sessions</SubmitButton>
        </form>
      </section>
    </div>
  );
}
