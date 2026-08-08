import Link from 'next/link';
import { requireUser, getFamilyAccount } from '@/lib/auth';
import { signOut } from '@/app/(auth)/actions';
import { DashboardNav } from '@/components/DashboardNav';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const account = await getFamilyAccount();

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-ink/10 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-lg font-bold text-brand-pink">
              My Account
            </Link>
            <div className="flex items-center gap-4">
              {account && (
                <span className="hidden text-sm text-brand-ink/60 sm:inline">
                  {account.parent1_email}
                </span>
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm text-brand-ink/60 hover:text-brand-ink hover:underline"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <div className="mt-3">
            <DashboardNav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
