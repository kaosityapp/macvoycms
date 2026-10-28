/**
 * Tell Renee Buckley her Sept 25 installment has been paused, not charged.
 *
 * She tried three times on the night of Sept 24 to switch her plan from the
 * stored card to a bank account, but none of the three checkout attempts
 * completed — no bank account was ever saved, so the card was still the one
 * on file. Rather than let the Sept 25 cron charge a card she's trying to
 * move away from, auto_charge was turned off on her plan (payment_plans.id =
 * f594bfff-9fe1-4bb2-a55e-1cf22c47bdca) ahead of the 9am ET run. This note
 * points her back to her dashboard to finish adding the bank account.
 *
 * Sent right away (not scheduled) so she has the rest of today and tonight
 * to redo the bank account entry ahead of the Sept 25 due date.
 *
 *   node scripts/send-buckley-payment-paused-note.mjs            # dry run, prints the email
 *   node scripts/send-buckley-payment-paused-note.mjs --send     # actually sends it
 */
import fs from 'node:fs';

const SEND = process.argv.includes('--send');
const FROM = 'MacVoy School of Irish Dance <alerts@macvoyirishdance.com>';
const SCHOOL_CONTACT_EMAIL = 'macvoyirishdance@rogers.com';
const PAYMENTS_URL = 'https://www.macvoyirishdance.com/dashboard/payments';

// --- the payment being discussed -------------------------------------------
const TO = 'renee.buckley89@gmail.com';
const FIRST_NAME = 'Renee';
const INSTALLMENT = '$696.00';
const DUE_DATE = 'September 25';

// Sending now instead of waiting for tomorrow morning, so she can redo the
// bank account entry tonight if she wants. Cancel the still-scheduled
// corrected version before sending immediately.
const SUPERSEDES_ID = '01a0d564-28e3-71f9-8c42-82e8aa6ca52b';

const DQ = String.fromCharCode(34), BS = String.fromCharCode(92);
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if (v.startsWith(DQ) && v.endsWith(DQ)) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v.split(BS).join('')];
    }),
);

const subject = `Your ${DUE_DATE} payment has been paused`;

const lines = [
  `Hi ${FIRST_NAME},`,
  `We saw you tried to switch your ${DUE_DATE} tuition installment (${INSTALLMENT}) from your card to a bank account last night, but the change didn’t go through — the new bank account was never saved, so your card was still the one on file.`,
  `Since we didn’t want to charge a card you’re trying to move away from, <strong>we’ve paused automatic billing for this installment</strong>. Nothing will be charged until you’ve sorted this out.`,
  `<strong>To finish setting up your bank account (or pay another way):</strong>`,
  `<a href="${PAYMENTS_URL}" style="display:inline-block;background:#d81b7a;color:#ffffff;padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none">Update payment details</a>`,
  `Once that’s done we’ll collect the ${DUE_DATE} installment and resume automatic billing for future ones.`,
  `Any questions, or if the bank account entry gives you trouble again, email <a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a>.`,
];

// Same automated footer and sender as every other family email — see
// sendPlainEmail in src/lib/integrations/adminAlert.ts.
const footer =
  `\n<p style="margin-top:24px;font-size:12px;color:#6b7280"><strong>THIS IS AN AUTOMATED MESSAGE</strong> ` +
  `— please do not reply. To reach the school, email ` +
  `<a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a>.</p>`;

if (!SEND) {
  console.log(`--- would send to ${TO} now ---`);
  console.log(`Subject: ${subject}\n`);
  console.log(lines.join('\n\n').replace(/<br>/g, '\n').replace(/<[^>]+>/g, ''));
  process.exit(0);
}

if (SUPERSEDES_ID) {
  const cancelRes = await fetch(`https://api.resend.com/emails/${SUPERSEDES_ID}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  if (!cancelRes.ok) {
    console.error(`Cancel of ${SUPERSEDES_ID} failed (${cancelRes.status}): ${await cancelRes.text().catch(() => '')}`);
    process.exit(1);
  }
  console.log(`cancelled ${SUPERSEDES_ID}`);
}

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: FROM,
    to: [TO],
    subject,
    html: lines.map((l) => `<p>${l}</p>`).join('\n') + footer,
  }),
});
if (!res.ok) {
  console.error(`FAILED (${res.status}): ${await res.text().catch(() => '')}`);
  process.exit(1);
}
const body = await res.json().catch(() => ({}));
console.log(`sent to ${TO} — id ${body.id ?? '(unknown)'}`);
