import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

async function count(table: keyof Database['public']['Tables']): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export default async function AdminOverviewPage() {
  const [families, dancers, seasons, announcements] = await Promise.all([
    count('family_accounts'),
    count('family_members'),
    count('seasons'),
    count('announcements'),
  ]);

  const cards = [
    { label: 'Families', value: families, href: '/admin/families' },
    { label: 'Dancers', value: dancers, href: '/admin/families' },
    { label: 'Seasons', value: seasons, href: '/admin/seasons' },
    { label: 'Announcements', value: announcements, href: '/admin/announcements' },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-pink">Admin overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-brand-ink/10 bg-white p-5 transition hover:border-brand-pink/40"
          >
            <div className="text-3xl font-bold text-brand-pink">{c.value}</div>
            <div className="mt-1 text-sm text-brand-ink/60">{c.label}</div>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <QuickLink href="/admin/seasons">Manage seasons & classes</QuickLink>
          <QuickLink href="/admin/families">View families</QuickLink>
          <QuickLink href="/admin/announcements/new">Send an announcement</QuickLink>
          <QuickLink href="/admin/payments">Export payments (CSV)</QuickLink>
        </div>
      </section>

      <p className="text-sm text-brand-ink/50">
        Public-site page editing (CMS) arrives with the public marketing site build (Phase 2).
      </p>
    </div>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink hover:bg-brand-pink/5"
    >
      {children}
    </Link>
  );
}
