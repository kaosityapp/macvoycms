import Link from 'next/link';
import { getCurrentSeason, getSeasonClassesGrouped, excludeFromOpenRegistration } from '@/lib/season';
import { formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Classes — MacVoy School of Irish Dance' };

function ageLabel(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'All ages';
  if (min != null && max != null) return `Ages ${min}–${max}`;
  if (min != null) return `Ages ${min}+`;
  return `Up to age ${max}`;
}

const WHY_IRISH_DANCE = [
  'Fun form of exercise',
  'Improves memory skills',
  'Improves balance and posture',
  'Increases flexibility and strength',
  'Boosts confidence and self-esteem',
  'Teaches discipline',
  'Builds good work ethic',
  'Great social activity',
  'Develop life long friendships',
  'Promote Irish culture',
  'Travel the world',
  'Develop competitive spirit',
  'Be part of a supportive team',
  'Creative outlet for all ages',
];

export default async function ClassesPage() {
  const season = await getCurrentSeason();
  const allGroups = season ? await getSeasonClassesGrouped(season.id) : [];
  const groups = excludeFromOpenRegistration(allGroups);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-pink">Classes</h1>
          <p className="mt-2 max-w-xl text-brand-ink/70">
            MacVoy School of Irish Dance offers competitive and recreational classes for boys and
            girls ages 3+ and adults.
          </p>
          {season && <p className="mt-1 text-sm text-brand-ink/50">{season.name} season schedule</p>}
        </div>
        <Link
          href="/register"
          className="rounded-md bg-brand-pink px-5 py-2.5 font-semibold text-white hover:bg-brand-pinkdark"
        >
          Register
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="mt-10 rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/70">
          The upcoming schedule will be posted soon — please check back.
        </p>
      ) : (
        <div className="mt-10 space-y-10">
          {groups.map((group) => (
            <section key={group.location.id}>
              <h2 className="text-xl font-bold text-brand-ink">{group.location.name}</h2>
              <ul className="mt-4 divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
                {group.classes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
                    <div>
                      <span className="font-medium text-brand-ink">{c.name}</span>
                      <span className="ml-2 text-sm text-brand-ink/60">{ageLabel(c.age_min, c.age_max)}</span>
                    </div>
                    <div className="text-sm text-brand-ink/70">
                      {c.day_of_week} · {formatTime(c.start_time)}–{formatTime(c.end_time)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 rounded-lg bg-brand-pink/5 px-5 py-4 text-sm text-brand-ink/80">
        Zoom classes and private lessons available upon request.
      </p>

      <section className="mt-16">
        <h2 className="text-2xl font-bold text-brand-pink">Why learn Irish dance?</h2>
        <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {WHY_IRISH_DANCE.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-brand-ink/80">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-pink" aria-hidden />
              {reason}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
