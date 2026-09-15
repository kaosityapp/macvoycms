import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Log in' };

const NOTICES: Record<string, string> = {
  auth: 'That sign-in link didn’t work — it may have expired, already been used, or been opened in a different browser than the one you requested it from. Request a new one below.',
  expired: 'That link has expired or was already used. Please request a new one.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm notice={error ? NOTICES[error] : undefined} />;
}
