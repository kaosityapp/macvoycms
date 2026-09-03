import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentSeason, getSeasonClassesGrouped } from '@/lib/season';
import { ContinuePrefilledForm } from './ContinuePrefilledForm';

export const dynamic = 'force-dynamic';

interface DancerPrefill {
  first_name: string;
  last_name: string;
  birthday?: string;
  gender?: string;
  address?: string;
  medical_notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  class_ids: string[];
  addon?: string;
  plan_type: string;
  total_amount: number;
  installment_schedule: { date: string; amount: number }[];
}

export default async function ContinueRegistrationPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .ilike('email', user.email ?? '')
    .eq('status', 'pending')
    .maybeSingle();

  if (!pending) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-pink">Nothing to confirm</h1>
        <p className="mt-4 text-brand-ink/70">
          We couldn&apos;t find a pending registration for this email — it may have already been
          completed, or the link has expired.
        </p>
        <Link href="/register" className="mt-6 inline-block text-brand-pink hover:underline">
          Go to registration →
        </Link>
      </main>
    );
  }

  const dancers = (pending.dancers ?? []) as unknown as DancerPrefill[];
  const season = await getCurrentSeason();
  const groups = season ? await getSeasonClassesGrouped(season.id) : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-brand-pink hover:underline">
          ← MacVoy School of Irish Dance
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-brand-pink">Confirm your registration</h1>
        <p className="mt-2 text-brand-ink/70">
          We&apos;ve pre-filled your dancer(s), classes, and payment plan below. Fix anything
          that&apos;s changed, set a password, and agree to the waivers to finish.
        </p>
      </div>

      <ContinuePrefilledForm
        email={user.email ?? ''}
        pending={{
          parent1_name: pending.parent1_name,
          parent1_phone: pending.parent1_phone,
          parent2_name: pending.parent2_name,
          parent2_phone: pending.parent2_phone,
          parent2_email: pending.parent2_email,
        }}
        dancers={dancers}
        groups={groups}
      />
    </main>
  );
}
