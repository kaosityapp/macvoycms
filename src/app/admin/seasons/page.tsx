import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDateShort } from '@/lib/format';
import { CreateSeasonForm } from './CreateSeasonForm';

export const dynamic = 'force-dynamic';

export default async function SeasonsPage() {
  const supabase = await createClient();
  const { data: seasons } = await supabase
    .from('seasons')
    .select('id, name, start_date, end_date, classes(count)')
    .order('start_date', { ascending: false });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-pink">Seasons &amp; Classes</h1>

      <ul className="space-y-3">
        {(seasons ?? []).map((s: any) => (
          <li key={s.id}>
            <Link
              href={`/admin/seasons/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-brand-ink/10 bg-white p-5 transition hover:border-brand-pink/40"
            >
              <div>
                <div className="font-semibold text-brand-ink">{s.name}</div>
                <div className="text-sm text-brand-ink/60">
                  {formatDateShort(s.start_date)} – {formatDateShort(s.end_date)}
                </div>
              </div>
              <div className="text-sm text-brand-ink/60">
                {s.classes?.[0]?.count ?? 0} classes →
              </div>
            </Link>
          </li>
        ))}
        {(seasons ?? []).length === 0 && (
          <li className="rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/70">
            No seasons yet — create one below.
          </li>
        )}
      </ul>

      <CreateSeasonForm />
    </div>
  );
}
