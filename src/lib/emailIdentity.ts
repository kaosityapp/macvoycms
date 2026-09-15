/**
 * Collapse an address to the mailbox it actually reaches, for duplicate
 * detection only.
 *
 * Eleven of the eighteen bot signups in September used dotted Gmail variants
 * — r.ol.land.n.g@, j.mr.oss.6.7@, c.o.ll.e.e.ncolom.bo@ and so on. Gmail
 * ignores dots entirely, so those all deliver to a handful of real inboxes.
 * Comparing raw strings makes each variant look like a brand-new family;
 * comparing normalised forms means one operator gets one account, not eleven.
 *
 * Only ever use this to decide "is this the same person as an existing
 * account". Always send mail to, and store, the address as the user typed it:
 * normalising for delivery would be wrong for providers that do treat dots as
 * significant.
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  // "+tag" routes to the base mailbox essentially everywhere.
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);

  // Dots are Gmail-specific. Stripping them elsewhere would wrongly merge
  // distinct people (first.last@ and firstlast@ can be two colleagues).
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }

  return `${local}@${domain}`;
}

/** Do these two addresses reach the same mailbox? */
export function sameMailbox(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b);
}

/**
 * Find an existing account whose address reaches the same mailbox.
 *
 * Scans in application code rather than SQL because the roll is small (43
 * accounts as of 2026-09-15, a few hundred at full size). If that stops being
 * true, add a stored `normalized_email` column with a unique index and match
 * on it instead of widening this scan.
 */
export function findMatchingAddress(
  candidate: string,
  existing: { email: string; id: string }[],
): { email: string; id: string } | null {
  const target = normalizeEmail(candidate);
  return existing.find((e) => normalizeEmail(e.email) === target) ?? null;
}
