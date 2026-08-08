import Link from 'next/link';

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
