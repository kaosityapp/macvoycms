import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

type Season = Database['public']['Tables']['seasons']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type Location = Database['public']['Tables']['locations']['Row'];

export type ClassWithLocation = ClassRow & { location: Pick<Location, 'id' | 'name'> };

export interface LocationClassGroup {
  location: Pick<Location, 'id' | 'name'>;
  classes: ClassWithLocation[];
}

/** Minutes between two 'HH:MM[:SS]' times. */
export function durationMinutes(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return toMin(end) - toMin(start);
}

/**
 * The season to register into: the one containing today, else the most recent
 * by start date. (Today is before the seeded 2026–2027 start, so the fallback
 * is what returns it for now.)
 */
export async function getCurrentSeason(): Promise<Season | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: active } = await supabase
    .from('seasons')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active) return active;

  const { data: latest } = await supabase
    .from('seasons')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest;
}

/** Rate map (duration_minutes → price) for a season. */
export async function getRateMap(seasonId: string): Promise<Map<number, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('rate_card')
    .select('duration_minutes, price')
    .eq('season_id', seasonId);
  return new Map((data ?? []).map((r) => [r.duration_minutes, Number(r.price)]));
}

/** Classes for a season, grouped by location and ordered by day/time. */
export async function getSeasonClassesGrouped(seasonId: string): Promise<LocationClassGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('classes')
    .select('*, location:locations(id, name)')
    .eq('season_id', seasonId)
    .order('start_time', { ascending: true });

  const rows = (data ?? []) as unknown as ClassWithLocation[];

  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  rows.sort(
    (a, b) =>
      dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week) ||
      a.start_time.localeCompare(b.start_time),
  );

  const groups = new Map<string, LocationClassGroup>();
  for (const row of rows) {
    const key = row.location.id;
    if (!groups.has(key)) groups.set(key, { location: row.location, classes: [] });
    groups.get(key)!.classes.push(row);
  }
  return [...groups.values()].sort((a, b) => a.location.name.localeCompare(b.location.name));
}
