import Link from 'next/link';
import { getFamilyAccount } from '@/lib/auth';
import { getAnnouncements, getReadAnnouncementIds } from '@/lib/dashboard';
import { formatTimestamp } from '@/lib/format';
import { stripHtml } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const account = await getFamilyAccount();
  if (!account) {
    return <p className="text-brand-ink/70">No family account found.</p>;
  }

  const [announcements, readIds] = await Promise.all([
    getAnnouncements(),
    getReadAnnouncementIds(account.id),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-pink">Announcements</h1>

      {announcements.length === 0 ? (
        <p className="rounded-lg border border-brand-ink/10 bg-white p-6 text-brand-ink/70">
          No announcements in the last 30 days.
        </p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => {
            const unread = !readIds.has(a.id);
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard/announcements/${a.id}`}
                  className="block rounded-lg border border-brand-ink/10 bg-white p-5 transition hover:border-brand-pink/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-brand-ink">{a.subject}</h2>
                    {unread && (
                      <span className="mt-1 shrink-0 rounded-full bg-brand-pink px-2 py-0.5 text-xs font-semibold text-white">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-brand-ink/60">{stripHtml(a.body)}</p>
                  <p className="mt-2 text-xs text-brand-ink/45">
                    {a.sent_at ? formatTimestamp(a.sent_at) : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
