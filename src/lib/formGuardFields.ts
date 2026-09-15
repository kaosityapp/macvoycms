/**
 * Shared, dependency-free bits of the registration spam guard — safe to import
 * from client components. The signing half lives in formGuard.ts (server only).
 */

/**
 * Honeypot input name. Deliberately non-semantic: browser autofill and password
 * managers fill fields they recognise ("company", "website", "nickname"), which
 * would flag real parents as bots. Nothing matches this, but a script that fills
 * every text input will.
 */
export const HONEYPOT_FIELD = 'confirm_parent_ref';

/** Hidden field carrying the signed form token issued when the page rendered. */
export const FORM_TOKEN_FIELD = 'form_token';

/**
 * Does this look like machine-generated filler rather than a person's name?
 *
 * The bots hitting this form submit random mixed-case strings with no spaces
 * ("EhWJcmpcgJWOkvwemRy", "tefMpbMZktIzImAG"). Checked against every name on
 * file as of 2026-09-15: all 36 bot strings match, and none of the 42 real
 * ones do — including the awkward cases ("Maryanne O'Sullivan-Fitzgerald",
 * "christinaobrien", "Wilmaaaaaaaa", "Nick (Helcim Test)").
 *
 * Known false positive: a genuine name typed as one run of CamelCase with no
 * spaces, e.g. "JeanPierreDeLaCroix". Judged acceptable because the rejection
 * message asks for a space between first and last name, so that parent
 * succeeds on their next attempt — and because this is only the third layer,
 * behind the honeypot and the signed token. Keep it conservative: wrongly
 * blocking a real family is far worse than letting a junk row through to the
 * other checks.
 */
export function looksLikeRandomString(value: string): boolean {
  const name = value.trim();
  if (name.length < 15) return false; // real names this long are rare; short ones never match
  if (/\s/.test(name)) return false; // any space at all means a human typed it
  return /[a-z][A-Z]/.test(name); // camelCase noise mid-word
}
