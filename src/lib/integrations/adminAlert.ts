/**
 * Plain email via Resend's HTTP API — admin alerts, and family notices that
 * don't need a Loops template. Separate from Loops (which needs a template
 * built in its dashboard) and from Supabase's SMTP config (auth emails
 * only, not reachable from app code) — this is a direct, dependency-free
 * path so things like a failed charge or a new registration can notify
 * someone without any new dashboard setup beyond an API key.
 *
 * Configure:
 *   RESEND_API_KEY     → same Resend account already used for Supabase SMTP
 *   ADMIN_ALERT_EMAILS → comma-separated recipient list (admin alerts only)
 *   ADMIN_ALERT_FROM   → verified sender, e.g. alerts@macvoyirishdance.com
 */

const RESEND_API = 'https://api.resend.com/emails';

export function isAdminAlertConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_ALERT_EMAILS);
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Send a plain email to an arbitrary recipient (e.g. a family, once approved). */
export async function sendPlainEmail(
  to: string | string[],
  subject: string,
  bodyLines: string[],
  opts?: { replyTo?: string },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = Array.isArray(to) ? to : [to];
  if (!apiKey || recipients.length === 0) {
    console.error('Email not sent (RESEND_API_KEY missing or no recipient):', subject);
    return;
  }

  const from = process.env.ADMIN_ALERT_FROM || 'MacVoy School of Irish Dance <alerts@macvoyirishdance.com>';
  const html = bodyLines.map((line) => `<p>${line}</p>`).join('\n');

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        ...(opts?.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Email send failed (${res.status}): ${detail}`);
    }
  } catch (err) {
    console.error('Email send failed:', (err as Error).message);
  }
}

export async function sendAdminAlert(subject: string, bodyLines: string[]): Promise<void> {
  const to = (process.env.ADMIN_ALERT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (to.length === 0) {
    console.error('Admin alert not sent (ADMIN_ALERT_EMAILS missing):', subject);
    return;
  }
  await sendPlainEmail(to, subject, bodyLines);
}
