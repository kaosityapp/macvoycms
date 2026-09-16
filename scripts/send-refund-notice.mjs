/**
 * Tell a family a payment was refunded, and why.
 *
 * Helcim's own notifications go to the merchant contact, not the customer, so
 * a refund otherwise reaches a family only as a number moving on their card
 * statement days later — easy to read as a double charge when the corrected
 * payment lands first.
 *
 *   node scripts/send-refund-notice.mjs            # dry run, prints the email
 *   node scripts/send-refund-notice.mjs --send     # actually sends
 */
import fs from 'node:fs';

const SEND = process.argv.includes('--send');
const FROM = 'MacVoy School of Irish Dance <alerts@macvoyirishdance.com>';
const SCHOOL_CONTACT_EMAIL = 'macvoyirishdance@rogers.com';

// --- the refund being announced -------------------------------------------
const TO = 'aliciasewell@hotmail.ca';
const FIRST_NAME = 'Alicia';
const REFUND_AMOUNT = '$804.00';
const ORIGINAL_DATE = 'Wednesday, September 16, 2026';
const TRANSACTION_ID = '54976004';
const NEW_TOTAL = '$828.12';
const INSTALLMENT = '$804.00';
const CARD_FEE = '$24.12';

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

const subject = `Refund issued — ${REFUND_AMOUNT} back to your card`;

const lines = [
  `Hi ${FIRST_NAME},`,
  `<strong>We have refunded ${REFUND_AMOUNT} to your card.</strong> This is a refund, not a second charge — the payment you made on ${ORIGINAL_DATE} (reference ${TRANSACTION_ID}) has been reversed in full.`,
  `<strong>Why:</strong> our system missed the card processing fee on that payment, so it charged the wrong amount. Rather than leave it wrong or bill you for the difference separately, we refunded the whole payment so it can be taken once, correctly.`,
  `<strong>When you'll see it:</strong> refunds usually appear within 7&ndash;10 business days, depending on your bank. It may take a statement cycle to show up, and there is nothing you need to do in the meantime.`,
  `<strong>What happens next:</strong> the installment will be charged again at ${NEW_TOTAL} &mdash; ${INSTALLMENT} tuition plus the ${CARD_FEE} card processing fee, shown as its own line on your receipt. That is the same fee every card payment carries; paying from a bank account instead has no fee.`,
  `Sorry for the confusion, and thank you for your patience. If anything looks wrong on your statement, or you would rather sort this out a different way, email <a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a> and we will take care of it.`,
];

// Same sender and automated footer as every other family email — see
// sendPlainEmail in src/lib/integrations/adminAlert.ts.
const footer =
  `\n<p style="margin-top:24px;font-size:12px;color:#6b7280"><strong>THIS IS AN AUTOMATED MESSAGE</strong> ` +
  `&mdash; please do not reply. To reach the school, email ` +
  `<a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a>.</p>`;

if (!SEND) {
  console.log(`--- would send to ${TO} ---`);
  console.log(`Subject: ${subject}\n`);
  console.log(lines.join('\n\n').replace(/<[^>]+>/g, '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—'));
  process.exit(0);
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
console.log(`sent to ${TO}`);
