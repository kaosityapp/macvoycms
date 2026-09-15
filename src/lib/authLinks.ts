import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isResendConfigured, sendPlainEmail } from '@/lib/integrations/adminAlert';

/**
 * Auth emails (password reset, magic sign-in links) sent by us rather than by
 * Supabase. Two separate real-world failures forced this:
 *
 * 1. PKCE is per-browser. Supabase's own `resetPasswordForEmail` /
 *    `signInWithOtp` store a code verifier in a cookie, so the link only
 *    completes in the browser that asked for it. That breaks a reset an admin
 *    sends on a family's behalf (verifier lands in the admin's browser) and
 *    anyone who requests on a phone but opens the mail on a laptop.
 *
 * 2. Mail security scanners follow links before the human does. Outlook and
 *    similar fetch every URL in a message to check it; Supabase's link is a
 *    one-time GET, so the scanner burns the token and the parent gets
 *    "Email link is invalid or has expired" on their first real click.
 *
 * So: mint the token server-side, mail a `token_hash` link to our own
 * /auth/confirm page, and have that page verify only on a POST from a real
 * button press. A scanner issuing GETs consumes nothing.
 */

export type AuthLinkResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'send_failed' };

/** Per-instance throttle so a double-click doesn't send two emails. */
const recentSends = new Map<string, number>();
const RESEND_COOLDOWN_MS = 60_000;

function throttled(key: string): boolean {
  const last = recentSends.get(key) ?? 0;
  if (Date.now() - last < RESEND_COOLDOWN_MS) return true;
  recentSends.set(key, Date.now());
  return false;
}

function confirmUrl(site: string, tokenHash: string, type: string, next: string): string {
  return (
    `${site}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}` +
    `&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`
  );
}

/** True when we can mint and send links ourselves (prod); false in bare local dev. */
export function canSendOwnAuthEmail(): boolean {
  return isResendConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function sendPasswordResetLink(
  email: string,
  origin: string,
): Promise<AuthLinkResult> {
  const address = email.trim().toLowerCase();
  const site = origin.replace(/\/+$/, '');

  if (throttled(`reset:${address}`)) return { ok: true };

  // Local dev without Resend / service role: fall back to Supabase's own
  // email (same-browser only, scanner-fragile — see note above).
  if (!canSendOwnAuthEmail()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${site}/auth/callback?next=/reset-password`,
    });
    return error ? { ok: false, reason: 'send_failed' } : { ok: true };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: address,
    options: { redirectTo: `${site}/reset-password` },
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    const notFound = isNotFound(error);
    if (!notFound) console.error('generateLink(recovery) failed:', error?.message);
    return { ok: false, reason: notFound ? 'not_found' : 'send_failed' };
  }

  const link = confirmUrl(site, tokenHash, 'recovery', '/reset-password');
  const sent = await sendPlainEmail(address, 'Reset your MacVoy password', [
    'Hi,',
    `We received a request to reset the password for your MacVoy School of Irish Dance account (${address}).`,
    button(link, 'Choose a new password'),
    `If the button doesn't work, copy this link into your browser:<br><a href="${link}">${link}</a>`,
    'This link works once and expires in about an hour. If you didn&rsquo;t ask for a reset, you can ignore this email &mdash; your password won&rsquo;t change.',
  ]);
  return sent ? { ok: true } : { ok: false, reason: 'send_failed' };
}

/**
 * A one-time sign-in link, used where someone has no password yet:
 * finishing a registration, and Parent 2 setting up their own login.
 * Creates the auth user if there isn't one, matching what signInWithOtp did.
 */
export async function sendMagicLink(
  email: string,
  origin: string,
  opts: { next: string; subject: string; intro: string; cta: string },
): Promise<AuthLinkResult> {
  const address = email.trim().toLowerCase();
  const site = origin.replace(/\/+$/, '');

  if (throttled(`magic:${address}:${opts.next}`)) return { ok: true };

  if (!canSendOwnAuthEmail()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${site}/auth/callback?next=${opts.next}` },
    });
    return error ? { ok: false, reason: 'send_failed' } : { ok: true };
  }

  const admin = createAdminClient();
  let result = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: address,
    options: { redirectTo: `${site}${opts.next}` },
  });

  // No account yet (first-time registrant / Parent 2). signInWithOtp used to
  // create one implicitly; do the same, then retry.
  if (isNotFound(result.error)) {
    const { error: createError } = await admin.auth.admin.createUser({
      email: address,
      email_confirm: true,
    });
    if (createError) {
      console.error('createUser for magic link failed:', createError.message);
      return { ok: false, reason: 'send_failed' };
    }
    result = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: address,
      options: { redirectTo: `${site}${opts.next}` },
    });
  }

  const tokenHash = result.data?.properties?.hashed_token;
  if (result.error || !tokenHash) {
    console.error('generateLink(magiclink) failed:', result.error?.message);
    return { ok: false, reason: 'send_failed' };
  }

  const link = confirmUrl(site, tokenHash, 'magiclink', opts.next);
  const sent = await sendPlainEmail(address, opts.subject, [
    'Hi,',
    opts.intro,
    button(link, opts.cta),
    `If the button doesn't work, copy this link into your browser:<br><a href="${link}">${link}</a>`,
    'This link works once and expires in about an hour.',
  ]);
  return sent ? { ok: true } : { ok: false, reason: 'send_failed' };
}

function isNotFound(error: { code?: string; status?: number; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'user_not_found' ||
    error.status === 404 ||
    /not found/i.test(error.message ?? '')
  );
}

function button(href: string, label: string): string {
  return (
    `<a href="${href}" style="display:inline-block;background:#d81b7a;color:#ffffff;` +
    `padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none">${label}</a>`
  );
}
