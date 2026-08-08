import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AnnouncementComposer } from './AnnouncementComposer';

export const dynamic = 'force-dynamic';

export default async function NewAnnouncementPage() {
  const supabase = await createClient();

  const [locationsRes, classesRes, membersRes] = await Promise.all([
    supabase.from('locations').select('id, name').order('name'),
    supabase
      .from('classes')
      .select('id, name, day_of_week, start_time, location:locations(name)')
      .order('start_time'),
    supabase
      .from('family_members')
      .select('id, first_name, last_name, family:family_accounts(parent1_name)')
      .order('last_name'),
  ]);

  const classes = ((classesRes.data ?? []) as any[]).map((c) => ({
    id: c.id,
    name: c.name,
    day_of_week: c.day_of_week,
    start_time: c.start_time,
    location_name: c.location?.name ?? '',
  }));

  const members = ((membersRes.data ?? []) as any[]).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`,
    family: m.family?.parent1_name ?? '',
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/announcements" className="text-sm text-brand-pink hover:underline">
          ← Announcements
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-brand-pink">New announcement</h1>
      </div>

      <AnnouncementComposer
        locations={(locationsRes.data ?? []) as any[]}
        classes={classes}
        members={members}
      />
    </div>
  );
}
