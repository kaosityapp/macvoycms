import Link from 'next/link';

// Utility auth pages (login/forgot-password/reset-password) — no SEO value,
// shouldn't be indexable; individual pages still set their own title.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <Link href="/" className="text-center">
        <span className="text-2xl font-bold text-brand-pink">
          MacVoy School of Irish Dance
        </span>
      </Link>
      <div className="rounded-xl border border-brand-ink/10 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
