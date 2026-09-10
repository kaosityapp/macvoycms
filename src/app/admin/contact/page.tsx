import { createClient } from '@/lib/supabase/server';
import { formatTimestamp } from '@/lib/format';
import { markContactRead, deleteContactMessage } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminContactPage() {
  const supabase = await createClient();
  const { data: messages } = await supabase
    .from('contact_messages')
    .select('id, name, email, location, message, read_at, created_at')
    .order('created_at', { ascending: false });

  const rows = messages ?? [];
  const unreadCount = rows.filter((m) => !m.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-brand-pink">Contact messages</h1>
        {unreadCount > 0 && (
          <span className="rounded-full bg-brand-pink/10 px-3 py-1 text-sm font-semibold text-brand-pink">
            {unreadCount} unread
          </span>
        )}
      </div>
      <p className="text-sm text-brand-ink/60">
        Every submission from the website&apos;s Contact page — emailed to macvoyirishdance@rogers.com
        immediately, and saved here so nothing is lost if an email bounces or gets marked as spam.
      </p>

      <ul className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
        {rows.map((m) => (
          <li key={m.id} className={`px-5 py-4 ${!m.read_at ? 'bg-brand-pink/5' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium text-brand-ink">
                  {m.name}{' '}
                  <span className="font-normal text-brand-ink/60">
                    ({m.email}) · {m.location}
                  </span>
                </div>
                <div className="text-xs text-brand-ink/50">{formatTimestamp(m.created_at)}</div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {!m.read_at ? (
                  <form action={markContactRead}>
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="text-brand-pink hover:underline">
                      Mark as read
                    </button>
                  </form>
                ) : (
                  <span className="text-brand-ink/40">Read {formatTimestamp(m.read_at)}</span>
                )}
                <form action={deleteContactMessage}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-brand-ink/80">{m.message}</p>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-6 text-brand-ink/60">No messages yet.</li>}
      </ul>
    </div>
  );
}
