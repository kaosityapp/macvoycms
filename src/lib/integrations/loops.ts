/**
 * Loops email integration (spec §2, §3.4).
 *
 * Transactional emails are sent from templates you create in Loops; each has a
 * transactional ID. Configure those IDs via env:
 *   - LOOPS_TID_REGISTRATION  → registration confirmation
 *   - LOOPS_TID_ANNOUNCEMENT   → announcement broadcast (uses {{subject}}/{{body}})
 *   - LOOPS_TID_RECEIPT        → payment receipt (future)
 *
 * Announcements are delivered as one transactional send per recipient, since
 * targeting is computed in-app. Aggregate open/click stats are not available
 * for transactional sends (that needs Loops Campaigns) — see getAnnouncementStats.
 */

const LOOPS_API = 'https://app.loops.so/api/v1';

export interface TransactionalEmailInput {
  to: string;
  /** A logical name (registration_confirmation / announcement / receipt) or a raw Loops template id. */
  transactionalId: string;
  dataVariables?: Record<string, string | number>;
}

export interface AnnouncementEmailInput {
  to: string[];
  subject: string;
  body: string;
}

export interface AnnouncementSendResult {
  loopsMessageId: string;
}

export interface AnnouncementStats {
  sent: number;
  opens: number;
  clicks: number;
}

function apiKey(): string {
  const key = process.env.LOOPS_API_KEY;
  if (!key) throw new Error('Loops is not configured (LOOPS_API_KEY missing).');
  return key;
}

/** Map a logical template name to its configured Loops id; pass-through raw ids. */
function resolveTemplateId(nameOrId: string): string | undefined {
  const map: Record<string, string | undefined> = {
    registration_confirmation: process.env.LOOPS_TID_REGISTRATION,
    announcement: process.env.LOOPS_TID_ANNOUNCEMENT,
    receipt: process.env.LOOPS_TID_RECEIPT,
  };
  return (nameOrId in map ? map[nameOrId] : nameOrId) || undefined;
}

async function postTransactional(
  transactionalId: string,
  email: string,
  dataVariables?: Record<string, string | number>,
): Promise<void> {
  const res = await fetch(`${LOOPS_API}/transactional`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transactionalId, email, dataVariables }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Loops transactional send failed (${res.status}): ${detail}`);
  }
}

/** Send a transactional email (registration confirmation, receipts, …). */
export async function sendTransactional(input: TransactionalEmailInput): Promise<void> {
  const id = resolveTemplateId(input.transactionalId);
  if (!id) {
    throw new Error(`No Loops template configured for "${input.transactionalId}".`);
  }
  await postTransactional(id, input.to, input.dataVariables);
}

/**
 * Dispatch an announcement (one transactional send per recipient). The record
 * is already saved to `announcements` before this is called.
 */
export async function sendAnnouncement(
  input: AnnouncementEmailInput,
): Promise<AnnouncementSendResult> {
  const id = process.env.LOOPS_TID_ANNOUNCEMENT;
  if (!id) throw new Error('LOOPS_TID_ANNOUNCEMENT is not set.');

  const recipients = [...new Set(input.to.filter(Boolean))];
  let sent = 0;
  for (const email of recipients) {
    try {
      await postTransactional(id, email, { subject: input.subject, body: input.body });
      sent += 1;
    } catch {
      // Partial delivery is acceptable; the archive is the source of truth.
    }
  }
  return { loopsMessageId: `loops-batch:${sent}/${recipients.length}` };
}

/**
 * Open/click stats. Transactional sends don't expose aggregate stats via the
 * Loops API, so this returns zeros. To get real stats, send announcements as a
 * Loops Campaign instead (a future enhancement).
 */
export async function getAnnouncementStats(_loopsMessageId: string): Promise<AnnouncementStats> {
  return { sent: 0, opens: 0, clicks: 0 };
}

export function isLoopsConfigured(): boolean {
  return Boolean(process.env.LOOPS_API_KEY);
}
