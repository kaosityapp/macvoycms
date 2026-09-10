import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatTimestamp } from '@/lib/format';
import { EditAnnouncementForm } from './EditAnnouncementForm';
import { deleteAnnouncement } from '../actions';

export const dynamic = 'force-dynamic';

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'All students',
  location: 'By location',
  class: 'By class',
  individual: 'Individuals',
};

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: a } = await supabase
    .from('announcements')
    .select('id, subject, body, audience_type, sent_at')
    .eq('id', id)
    .maybeSingle();
  if (!a) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/announcements" className="text-sm text-brand-pink hover:underline">
          ← Announcements
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-pink">Edit announcement</h1>
        <p className="text-sm text-brand-ink/60">
          {AUDIENCE_LABEL[a.audience_type] ?? a.audience_type}
          {a.sent_at ? ` · sent ${formatTimestamp(a.sent_at)}` : ''}
        </p>
      </div>

      <EditAnnouncementForm id={a.id} subject={a.subject} body={a.body} />

      <p className="text-xs text-brand-ink/50">
        Editing updates the in-app archive parents see. It does not re-send the email.
      </p>

      <details className="rounded-md border border-red-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-red-700">Delete this announcement</summary>
        <form action={deleteAnnouncement} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={a.id} />
          <p className="text-xs text-brand-ink/60">
            Removes it permanently, including from every parent&apos;s portal. Already-sent emails aren&apos;t
            recalled.
          </p>
          <button
            type="submit"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete permanently
          </button>
        </form>
      </details>
    </div>
  );
}
