import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { signOut } from '@/app/(auth)/actions';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="bg-brand-pink">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="text-lg font-bold text-white">
              MacVoy Admin
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-white/70 hover:text-white">
                Parent view
              </Link>
              <form action={signOut}>
                <button type="submit" className="text-sm text-white/70 hover:text-white">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <div className="mt-3">
            <AdminNav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
