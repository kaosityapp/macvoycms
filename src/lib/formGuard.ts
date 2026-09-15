import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { HONEYPOT_FIELD, FORM_TOKEN_FIELD, looksLikeRandomString } from '@/lib/formGuardFields';

/**
 * Spam guard for the public registration form.
 *
 * Between 2026-09-11 and 2026-09-15 automated signups created 18 of the 43
 * family accounts on file — random mixed-case parent names, unformatted
 * 10-digit phone numbers, always the first "how did you hear about us" option,
 * and (latterly) a dancer attached too. None ever signed in.
 *
 * Three cheap, invisible checks, aimed at different attacker shapes:
 *
 *  - Honeypot: a hidden input a script fills and a person never sees.
 *  - Signed form token: proves the submission came from a page we rendered,
 *    and that a plausible amount of time passed. Catches anything posting the
 *    action directly, where no honeypot field would be present at all.
 *  - Name plausibility: rejects random-string filler outright.
 *
 * Deliberately NOT a CAPTCHA. Most MacVoy parents are non-technical and a
 * challenge on the registration form costs real enrolments. If these bots
 * adapt, Cloudflare Turnstile in invisible mode is the next step — it slots in
 * at the same place as verifyRegistrationForm().
 */

const MIN_FILL_MS = 5_000; // nobody completes this form in five seconds
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // a tab left open all afternoon is fine

/**
 * HMAC key. Derived from the service-role key rather than adding another env
 * var to configure; the derivation means the token can never leak the key back.
 * FORM_GUARD_SECRET overrides it if you'd rather rotate the two separately.
 */
function signingKey(): string {
  const explicit = process.env.FORM_GUARD_SECRET;
  if (explicit) return explicit;
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHash('sha256').update(`macvoy-form-guard:${base}`).digest('hex');
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('hex');
}

/** Issue a token when the registration page renders. */
export function issueFormToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

export interface GuardFailure {
  ok: false;
  /** Shown to the submitter. */
  reason: string;
  /** Server log only — never surfaced, so bots can't learn which check fired. */
  logDetail: string;
}
export type GuardResult = { ok: true } | GuardFailure;

/**
 * Generic "please try again" wording on purpose: a message naming the check
 * that fired tells whoever is running the script exactly what to change.
 */
const GENERIC_REJECTION =
  'We couldn’t process this registration. Please reload the page and try again, or email macvoyirishdance@rogers.com and we’ll register your dancer for you.';

export function verifyRegistrationForm(formData: FormData): GuardResult {
  // 1. Honeypot — present and non-empty means a script filled every input.
  const honeypot = String(formData.get(HONEYPOT_FIELD) ?? '').trim();
  if (honeypot) {
    return { ok: false, reason: GENERIC_REJECTION, logDetail: 'honeypot filled' };
  }

  // 2. Signed token from the page render.
  const token = String(formData.get(FORM_TOKEN_FIELD) ?? '');
  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature) {
    return { ok: false, reason: GENERIC_REJECTION, logDetail: 'missing form token' };
  }

  const expected = sign(issuedAt);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: GENERIC_REJECTION, logDetail: 'bad form token signature' };
  }

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0) {
    return { ok: false, reason: GENERIC_REJECTION, logDetail: 'form token from the future' };
  }
  if (age < MIN_FILL_MS) {
    return { ok: false, reason: GENERIC_REJECTION, logDetail: `submitted in ${age}ms` };
  }
  if (age > MAX_AGE_MS) {
    return {
      ok: false,
      reason: 'This page has been open a while. Please reload it and submit again.',
      logDetail: 'form token expired',
    };
  }

  return { ok: true };
}

/**
 * Name plausibility, checked separately so the parent gets wording they can
 * actually act on (unlike the deliberately vague bot rejection above).
 */
export function checkParentNames(names: (string | null | undefined)[]): GuardFailure | null {
  for (const name of names) {
    if (name && looksLikeRandomString(name)) {
      return {
        ok: false,
        reason: 'Please enter the parent/guardian name as it would normally be written, with a space between first and last name.',
        logDetail: 'name looks machine-generated',
      };
    }
  }
  return null;
}
