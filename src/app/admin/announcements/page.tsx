import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isLoopsConfigured } from '@/lib/integrations/loops';
import { formatTimestamp } from '@/lib/format';

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

  const loopsOn = isLoopsConfigured();

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

      {!loopsOn && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Announcements are saved and shown in parents&apos; portals immediately. Email delivery and
          open/click stats activate once Loops is connected.
        </p>
      )}

      <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
        {(announcements ?? []).map((a: any) => (
          <li key={a.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="font-medium text-brand-ink">{a.subject}</div>
              <div className="text-sm text-brand-ink/60">
                {AUDIENCE_LABEL[a.audience_type] ?? a.audience_type}
                {a.sent_at ? ` · ${formatTimestamp(a.sent_at)}` : ' · draft'}
              </div>
            </div>
            <div className="text-sm text-brand-ink/50">
              {loopsOn ? (a.loops_message_id ? 'Email sent' : 'In-app only') : 'Stats pending Loops'}
            </div>
          </li>
        ))}
        {(announcements ?? []).length === 0 && (
          <li className="px-5 py-6 text-brand-ink/60">No announcements yet.</li>
        )}
      </ul>
    </div>
  );
}
