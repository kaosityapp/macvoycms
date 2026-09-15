'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { sendPasswordResetLink } from '@/lib/authLinks';

export interface AuthState {
  error?: string;
  message?: string;
}

const emailSchema = z.string().email('Enter a valid email address.');

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  if (!password) return { error: 'Enter your password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Incorrect email or password.' };

  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const result = await sendPasswordResetLink(email, origin);
  if (!result.ok && result.reason === 'send_failed') {
    return { error: "We couldn't send the reset email just now. Please try again in a minute." };
  }

  // Unknown address still reports success — don't reveal whether an email is registered.
  return {
    message: 'If that email is registered, a password reset link is on its way.',
  };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link has expired. Request a new one from the "Forgot password?" link.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect('/dashboard');
}
