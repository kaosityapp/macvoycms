import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDateLong, formatTime, money } from '@/lib/format';
import { CreateClassForm } from './CreateClassForm';

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

  const [classesRes, locationsRes] = await Promise.all([
    supabase
      .from('classes')
      .select(
        'id, name, day_of_week, start_time, end_time, level, hourly_rate, total_sessions, location:locations(name)',
      )
      .eq('season_id', id),
    supabase.from('locations').select('id, name').order('name'),
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
                    {c.location?.name}
                  </div>
                </div>
                <div className="text-right text-sm text-brand-ink/60">
                  {c.hourly_rate != null ? `${money(c.hourly_rate)}/hr` : 'no rate'}
                  {c.total_sessions != null && ` · ${c.total_sessions} classes`}
                </div>
              </Link>
            </li>
          ))}
          {classes.length === 0 && (
            <li className="px-5 py-4 text-brand-ink/60">No classes yet.</li>
          )}
        </ul>
      </section>

      <CreateClassForm locations={(locationsRes.data ?? []) as any[]} />
    </div>
  );
}
