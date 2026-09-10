import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { signOut } from '@/app/(auth)/actions';
import { AdminNav } from '@/components/AdminNav';

export const dynamic = 'force-dynamic';

// Private, auth-gated area — never indexed. Belt-and-suspenders with
// robots.txt (src/app/robots.ts), which disallows crawling /admin entirely;
// this tag additionally stops indexing even if a page were somehow crawled
// or linked to directly.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

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
