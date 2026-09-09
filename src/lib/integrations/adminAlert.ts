/**
 * Plain admin email alerts (payment failures, etc.) via Resend's HTTP API.
 * Separate from Loops (which needs a template built in its dashboard) and
 * from Supabase's SMTP config (auth emails only, not reachable from app
 * code) — this is a direct, dependency-free path so a failed charge can
 * notify Debbie/Nick without any new dashboard setup beyond an API key.
 *
 * Configure:
 *   RESEND_API_KEY   → same Resend account already used for Supabase SMTP
 *   ADMIN_ALERT_EMAILS → comma-separated recipient list
 *   ADMIN_ALERT_FROM  → verified sender, e.g. alerts@macvoyirishdance.com
 */

const RESEND_API = 'https://api.resend.com/emails';

export function isAdminAlertConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_ALERT_EMAILS);
}

export async function sendAdminAlert(subject: string, bodyLines: string[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.ADMIN_ALERT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (!apiKey || to.length === 0) {
    console.error('Admin alert not sent (RESEND_API_KEY/ADMIN_ALERT_EMAILS missing):', subject);
    return;
  }

  const from = process.env.ADMIN_ALERT_FROM || 'MacVoy Alerts <alerts@macvoyirishdance.com>';
  const html = bodyLines.map((line) => `<p>${line}</p>`).join('\n');

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Admin alert send failed (${res.status}): ${detail}`);
    }
  } catch (err) {
    console.error('Admin alert send failed:', (err as Error).message);
  }
}
