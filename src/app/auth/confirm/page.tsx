import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmEmailLink } from './actions';

export const metadata: Metadata = {
  title: 'Confirm your email link',
  robots: { index: false, follow: false },
};

const COPY: Record<string, { heading: string; blurb: string; cta: string }> = {
  recovery: {
    heading: 'Reset your password',
    blurb: 'Click below to choose a new password for your MacVoy account.',
    cta: 'Continue to set my password',
  },
  magiclink: {
    heading: "Confirm it's you",
    blurb: 'Click below to sign in to your MacVoy account.',
    cta: 'Continue to sign in',
  },
};

/**
 * The landing page for every emailed auth link. It deliberately does NOT
 * verify anything on load: mail scanners fetch links to vet them, and a
 * link that signs you in on GET is spent before the real person clicks it.
 * Verification happens in the POST server action behind this button.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash: tokenHash, type = '', next = '/dashboard' } = await searchParams;
  const copy = COPY[type] ?? COPY.magiclink;

  if (!tokenHash) {
    return (
      <Shell heading="This link isn't complete">
        <p className="text-sm text-brand-ink/70">
          The link was missing information, which usually means it got cut in half by an email
          app. Request a new one and open it directly from the email.
        </p>
        <Link href="/forgot-password" className="text-sm font-medium text-brand-pink hover:underline">
          Request a new link
        </Link>
      </Shell>
    );
  }

  return (
    <Shell heading={copy.heading}>
      <p className="text-sm text-brand-ink/70">{copy.blurb}</p>
      <form action={confirmEmailLink}>
        <input type="hidden" name="token_hash" value={tokenHash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="rounded-md bg-brand-pink px-5 py-2.5 font-semibold text-white hover:bg-brand-pinkdark"
        >
          {copy.cta}
        </button>
      </form>
      <p className="text-xs text-brand-ink/50">
        This link works once and expires about an hour after it was sent.
      </p>
    </Shell>
  );
}

function Shell({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-16">
      <Link href="/" className="text-center">
        <span className="text-2xl font-bold text-brand-pink">MacVoy School of Irish Dance</span>
      </Link>
      <div className="space-y-4 rounded-xl border border-brand-ink/10 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-brand-pink">{heading}</h1>
        {children}
      </div>
    </main>
  );
}
