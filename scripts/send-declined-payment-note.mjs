/**
 * Tell a family their bank declined a charge we attempted, and how to pay.
 *
 * A merchant-initiated charge against a stored card gives the family no
 * feedback at all when it fails — the only thing they'd see is a fraud alert
 * from their bank about a payment they didn't know was coming.
 *
 *   node scripts/send-declined-payment-note.mjs            # dry run, prints the email
 *   node scripts/send-declined-payment-note.mjs --send     # actually sends
 */
import fs from 'node:fs';

const SEND = process.argv.includes('--send');
const FROM = 'MacVoy School of Irish Dance <alerts@macvoyirishdance.com>';
const SCHOOL_CONTACT_EMAIL = 'macvoyirishdance@rogers.com';
const PAYMENTS_URL = 'https://www.macvoyirishdance.com/dashboard/payments';

// --- the payment being discussed -------------------------------------------
const TO = 'aliciasewell@hotmail.ca';
const FIRST_NAME = 'Alicia';
const INSTALLMENT = '$804.00';
const DUE_DATE = 'September 10';
const CARD_TOTAL = '$828.12';
const CARD_FEE = '$24.12';
const REFUND_AMOUNT = '$804.00';

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

const subject = `Your ${DUE_DATE} payment — your bank declined our attempt`;

const lines = [
  `Hi ${FIRST_NAME},`,
  `Following on from the refund email: when we went to take the ${DUE_DATE} installment again at the corrected amount, <strong>your bank declined it as a suspected fraudulent charge</strong>. Nothing was charged, and there is nothing wrong with your card as far as we can tell.`,
  `Refunding ${REFUND_AMOUNT} and then charging a slightly different amount on the same card an hour later is exactly the pattern banks watch for, so the second attempt got blocked automatically. If the card belongs to someone else in your household, they may have received the fraud alert rather than you.`,
  `<strong>The refund is still on its way</strong> &mdash; 7&ndash;10 business days, depending on the bank. That part is unaffected.`,
  `<strong>The easiest way to sort this out is to pay it yourself from your account:</strong>`,
  `<a href="${PAYMENTS_URL}" style="display:inline-block;background:#d81b7a;color:#ffffff;padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none">Pay the ${DUE_DATE} installment</a>`,
  `A payment you start yourself usually goes through where ours was blocked. You will see two options there:`,
  `&bull; <strong>By card &mdash; ${CARD_TOTAL}</strong> (${INSTALLMENT} tuition plus the ${CARD_FEE} card processing fee, shown as its own line)<br>&bull; <strong>By bank account &mdash; ${INSTALLMENT}</strong>, with no processing fee at all`,
  `If you would rather we took it from the card on file, call the number on the back of the card, let them know the charge from MacVoy School of Irish Dance is expected, then email <a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a> to say so &mdash; we will run it again after that.`,
  `Any questions, or if you would like to arrange this a different way, email <a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a>.`,
];

// Same automated footer and sender as every other family email — see
// sendPlainEmail in src/lib/integrations/adminAlert.ts.
const footer =
  `\n<p style="margin-top:24px;font-size:12px;color:#6b7280"><strong>THIS IS AN AUTOMATED MESSAGE</strong> ` +
  `&mdash; please do not reply. To reach the school, email ` +
  `<a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a>.</p>`;

if (!SEND) {
  console.log(`--- would send to ${TO} ---`);
  console.log(`Subject: ${subject}\n`);
  console.log(
    lines
      .join('\n\n')
      .replace(/<br>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&ndash;/g, '–')
      .replace(/&mdash;/g, '—')
      .replace(/&bull;/g, '•'),
  );
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
