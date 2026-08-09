import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatTimestamp } from '@/lib/format';
import { EditAnnouncementForm } from './EditAnnouncementForm';

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
    </div>
  );
}
