'use server';

import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/safeNext';

const ALLOWED_TYPES = new Set<EmailOtpType>(['recovery', 'magiclink', 'email', 'signup', 'invite']);

/**
 * Verify an emailed one-time token. Deliberately a POST-only server action:
 * mail scanners (Outlook and friends) follow links with GET to check them,
 * and any GET that verifies would burn the token before the parent clicks.
 */
export async function confirmEmailLink(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get('token_hash') ?? '');
  const rawType = String(formData.get('type') ?? '');
  const next = safeNextPath(String(formData.get('next') ?? ''), '/dashboard');
  const type = rawType as EmailOtpType;

  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    redirect(failurePath(rawType));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    // A one-time token is spent by the first POST, so a second one — a double
    // tap on a phone, a refresh, a back-then-submit — always fails. If that
    // first press did sign them in, honour it: bouncing them to "your link
    // expired" threw away a working session and stranded them a step short of
    // finishing. (Seen live: a parent reached /register/continue, then her own
    // second tap replaced it with the login page two seconds later.)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(next);

    console.warn('confirmEmailLink verifyOtp failed:', error.message);
    redirect(failurePath(rawType));
  }

  redirect(next);
}

function failurePath(type: string): string {
  return type === 'recovery' ? '/forgot-password?error=expired' : '/login?error=expired';
}
