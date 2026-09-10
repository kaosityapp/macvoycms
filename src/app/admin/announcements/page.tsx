import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatTimestamp } from '@/lib/format';
import { deleteAnnouncement } from './actions';

export const dynamic = 'force-dynamic';

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'All students',
  location: 'By location',
  class: 'By class',
  individual: 'Individuals',
};

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, subject, audience_type, sent_at, loops_message_id')
    .order('sent_at', { ascending: false, nullsFirst: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-pink">Announcements</h1>
        <Link
          href="/admin/announcements/new"
          className="rounded-md bg-brand-pink px-4 py-2 font-semibold text-white hover:bg-brand-pink/90"
        >
          New announcement
        </Link>
      </div>

      <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
        {(announcements ?? []).map((a: any) => {
          const deliveryLabel =
            typeof a.loops_message_id === 'string' && a.loops_message_id.startsWith('direct:')
              ? `Emailed ${a.loops_message_id.slice('direct:'.length)}`
              : 'In-app only';
          return (
            <li key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-brand-pink/5">
              <Link href={`/admin/announcements/${a.id}`} className="min-w-0 flex-1">
                <div className="font-medium text-brand-ink">{a.subject}</div>
                <div className="text-sm text-brand-ink/60">
                  {AUDIENCE_LABEL[a.audience_type] ?? a.audience_type}
                  {a.sent_at ? ` · ${formatTimestamp(a.sent_at)}` : ' · draft'}
                </div>
              </Link>
              <span className="whitespace-nowrap text-sm text-brand-ink/50">{deliveryLabel}</span>
              <form action={deleteAnnouncement}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </form>
            </li>
          );
        })}
        {(announcements ?? []).length === 0 && (
          <li className="px-5 py-6 text-brand-ink/60">No announcements yet.</li>
        )}
      </ul>
    </div>
  );
}
