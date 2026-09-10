import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo.png" alt="MacVoy School of Irish Dance" className="h-24 w-auto" />
      <h1 className="mt-8 text-3xl font-bold text-brand-pink">Page not found</h1>
      <p className="mt-3 max-w-md text-brand-ink/70">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-md bg-brand-pink px-5 py-2.5 font-semibold text-white hover:bg-brand-pinkdark"
        >
          Back to home
        </Link>
        <Link
          href="/classes"
          className="rounded-md border border-brand-ink px-5 py-2.5 font-semibold text-brand-ink hover:bg-brand-ink hover:text-white"
        >
          View classes
        </Link>
      </div>
    </div>
  );
}
