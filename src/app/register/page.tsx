import Link from 'next/link';
import { getCurrentSeason, getRateMap, getSeasonClassesGrouped } from '@/lib/season';
import { getFamilyAccount } from '@/lib/auth';
import { RegistrationForm } from './RegistrationForm';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const season = await getCurrentSeason();

  if (!season) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-pink">Registration</h1>
        <p className="mt-4 text-brand-ink/70">
          Registration isn&apos;t open yet — no season has been set up. Please check back soon.
        </p>
      </main>
    );
  }

  const [groups, rateMap, account] = await Promise.all([
    getSeasonClassesGrouped(season.id),
    getRateMap(season.id),
    getFamilyAccount(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-brand-pink hover:underline">
          ← MacVoy School of Irish Dance
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-brand-pink">
          Register a dancer — {season.name}
        </h1>
        <p className="mt-2 text-brand-ink/70">
          Each dancer is registered individually. You can add more dancers to the same account
          after this one.
        </p>
      </div>

      <RegistrationForm
        groups={groups}
        rateEntries={[...rateMap.entries()]}
        isLoggedIn={Boolean(account)}
        parentName={account?.parent1_name ?? null}
      />
    </main>
  );
}
