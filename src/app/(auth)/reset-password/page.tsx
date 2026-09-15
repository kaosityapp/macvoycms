import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = { title: 'Set your password' };

export default async function ResetPasswordPage() {
  const user = await getSessionUser();

  // The reset link signs the user in before landing here. No session means
  // the link was expired, already used, or never completed — say so instead
  // of showing a form that can't succeed.
  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-brand-pink">This reset link isn&apos;t valid</h1>
          <p className="mt-1 text-sm text-brand-ink/70">
            It may have expired or already been used. Reset links work once and last about an hour.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-block rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Request a new reset link
        </Link>
        <Link href="/login" className="block text-sm text-brand-pink hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm />;
}
