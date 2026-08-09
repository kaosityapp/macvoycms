import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFamilyAccount } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatTimestamp } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getFamilyAccount();
  if (!account) return <p className="text-brand-ink/70">No family account found.</p>;

  const supabase = await createClient();

  // RLS returns the row only if it's sent and targeted at this family.
  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, subject, body, sender, sent_at')
    .eq('id', id)
    .maybeSingle();

  if (!announcement) notFound();

  // Record the in-app read (idempotent; separate from email open tracking).
  await supabase.from('announcement_reads').upsert(
    { announcement_id: announcement.id, family_account_id: account.id },
    { onConflict: 'announcement_id,family_account_id', ignoreDuplicates: true },
  );

  return (
    <article className="space-y-6">
      <Link href="/dashboard/announcements" className="text-sm text-brand-pink hover:underline">
        ← All announcements
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-brand-pink">{announcement.subject}</h1>
        <p className="mt-1 text-sm text-brand-ink/50">
          From {announcement.sender}
          {announcement.sent_at ? ` · ${formatTimestamp(announcement.sent_at)}` : ''}
        </p>
      </header>

      {/<[a-z][\s\S]*>/i.test(announcement.body) ? (
        <div
          className="rounded-lg border border-brand-ink/10 bg-white p-6 leading-relaxed text-brand-ink/90 [&_a]:text-brand-pink [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: announcement.body }}
        />
      ) : (
        <div className="whitespace-pre-line rounded-lg border border-brand-ink/10 bg-white p-6 leading-relaxed text-brand-ink/90">
          {announcement.body}
        </div>
      )}
    </article>
  );
}
