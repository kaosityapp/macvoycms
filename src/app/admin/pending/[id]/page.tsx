import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentSeason, getSeasonClassesGrouped } from '@/lib/season';
import { EditPendingForm } from './EditPendingForm';

export const dynamic = 'force-dynamic';

export default async function PendingRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from('pending_registrations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!pending) notFound();

  const season = await getCurrentSeason();
  const groups = season ? await getSeasonClassesGrouped(season.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/families" className="text-sm text-brand-pink hover:underline">
          ← All dancers
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-brand-pink">{pending.email}</h1>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            Pending
          </span>
        </div>
        <p className="text-sm text-brand-ink/60">
          Imported from the spreadsheet — the family hasn&apos;t confirmed yet. Edits here appear the
          moment they open their confirmation link.
        </p>
      </div>

      <EditPendingForm
        pendingId={pending.id}
        pending={{
          parent1_name: pending.parent1_name,
          parent1_phone: pending.parent1_phone,
          parent2_name: pending.parent2_name,
          parent2_phone: pending.parent2_phone,
          parent2_email: pending.parent2_email,
        }}
        dancers={(pending.dancers ?? []) as any[]}
        groups={groups}
      />
    </div>
  );
}
