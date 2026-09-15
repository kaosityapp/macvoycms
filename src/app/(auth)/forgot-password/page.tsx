import type { Metadata } from 'next';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = { title: 'Reset your password' };

const NOTICES: Record<string, string> = {
  expired:
    'That reset link has expired or was already used. Enter your email below and we’ll send a fresh one.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ForgotPasswordForm notice={error ? NOTICES[error] : undefined} />;
}
