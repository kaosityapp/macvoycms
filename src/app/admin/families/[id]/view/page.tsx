import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { todayIso } from '@/lib/billing/dueDates';
import { formatDateLong, formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DancerViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: dancer } = await supabase
    .from('family_members')
    .select('id, first_name, last_name, enrollments(status, class:classes(id))')
    .eq('id', id)
    .maybeSingle();
  if (!dancer) notFound();

  const d = dancer as any;
  const classIds = (d.enrollments ?? [])
    .filter((e: any) => e.status === 'active' && e.class)
    .map((e: any) => e.class.id);

  let sessions: any[] = [];
  if (classIds.length) {
    const { data } = await supabase
      .from('class_sessions')
      .select(
        'id, session_date, start_time, end_time, status, note, class:classes(name, location:locations(name))',
      )
      .in('class_id', classIds)
      .gte('session_date', todayIso())
      .neq('status', 'removed')
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(40);
    sessions = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/families/${d.id}`} className="text-sm text-brand-pink hover:underline">
          ← {d.first_name} {d.last_name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-pink">
          Dancer view — {d.first_name} {d.last_name}
        </h1>
        <p className="text-sm text-brand-ink/60">
          The upcoming schedule exactly as it appears on their calendar.
        </p>
      </div>

      <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
        {sessions.length === 0 && (
          <p className="px-5 py-4 text-brand-ink/60">No upcoming classes.</p>
        )}
        {sessions.map((s) => {
          const cancelled = s.status === 'cancelled';
          return (
            <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <div className={`font-medium ${cancelled ? 'text-red-400 line-through' : 'text-brand-ink'}`}>
                  {s.class?.name}
                </div>
                <div className="text-sm text-brand-ink/60">
                  {formatDateLong(s.session_date)} · {formatTime(s.start_time)}–{formatTime(s.end_time)}
                  {s.class?.location?.name ? ` · ${s.class.location.name}` : ''}
                </div>
                {cancelled && s.note && <div className="text-xs font-medium text-red-600">{s.note}</div>}
              </div>
              {cancelled && <span className="text-xs font-semibold text-red-600">Cancelled</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
