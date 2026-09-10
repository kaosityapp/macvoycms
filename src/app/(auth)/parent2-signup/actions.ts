'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RequestState {
  error?: string;
  message?: string;
}

const emailSchema = z.string().email('Enter a valid email address.');

/**
 * Step 1: Parent 2 enters the email Debbie/Parent 1 has on file as "Parent 2".
 * If it matches a family with no Parent 2 login yet, send a magic link to
 * /parent2-signup/confirm to set a password and link their own login.
 */
export async function requestParent2Login(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const parsed = emailSchema.safeParse(String(formData.get('email') ?? '').trim());
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const email = parsed.data;

  const admin = createAdminClient();
  const { data: family } = await admin
    .from('family_accounts')
    .select('id')
    .ilike('parent2_email', email)
    .is('parent2_auth_user_id', null)
    .maybeSingle();

  // Always report success either way — don't reveal whether an email is on
  // file as somebody's Parent 2 (same reasoning as the password-reset flow).
  if (family) {
    const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/parent2-signup/confirm` },
    });
  }

  return {
    message: "If that email is on file as a Parent 2 contact, we've sent a link to set up your login.",
  };
}

export interface ConfirmState {
  error?: string;
}

/** Step 2: after the magic link signs them in, set a password and link this login. */
export async function confirmParent2Login(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Your link has expired. Request a new one.' };

  const admin = createAdminClient();
  const { data: family } = await admin
    .from('family_accounts')
    .select('id')
    .ilike('parent2_email', user.email)
    .is('parent2_auth_user_id', null)
    .maybeSingle();
  if (!family) {
    return { error: "This login isn't linked to a Parent 2 contact — contact us for help." };
  }

  const { error: pwError } = await supabase.auth.updateUser({ password });
  if (pwError) return { error: 'Could not set your password. Please try again.' };

  const { error } = await admin
    .from('family_accounts')
    .update({ parent2_auth_user_id: user.id })
    .eq('id', family.id);
  if (error) return { error: 'Could not link your login. Please contact us.' };

  redirect('/dashboard');
}
