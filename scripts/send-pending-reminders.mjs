/**
 * One-off: re-send a "finish your registration" link to families who verified
 * their email but never got through the confirmation form.
 *
 * They were stranded by the double-tap bug in /auth/confirm (fixed in
 * 9e84a00): the second press of the button spent an already-spent token, and
 * the resulting "your link expired" redirect threw away the session the first
 * press had just created. Their pending_registrations row is untouched, so a
 * fresh link is all they need.
 *
 * Mirrors sendMagicLink + sendPlainEmail (src/lib/authLinks.ts,
 * src/lib/integrations/adminAlert.ts) — those import next/headers and can't
 * run outside the app.
 *
 *   node scripts/send-pending-reminders.mjs            # dry run, prints the email
 *   node scripts/send-pending-reminders.mjs --send     # actually sends
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const SEND = process.argv.includes('--send');
const SITE = 'https://www.macvoyirishdance.com';
const FROM = 'MacVoy School of Irish Dance <alerts@macvoyirishdance.com>';
const SCHOOL_CONTACT_EMAIL = 'macvoyirishdance@rogers.com';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function button(href, label) {
  return (
    `<a href="${href}" style="display:inline-block;background:#d81b7a;color:#ffffff;` +
    `padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none">${label}</a>`
  );
}

function bodyLines(firstName, dancers, link, hasPlan) {
  // Not every import row has a price yet — don't promise a schedule that
  // Debbie hasn't set.
  const onFile = hasPlan
    ? "your dancer's details, classes and payment schedule"
    : "your dancer's details and classes";
  return [
    `Hi ${firstName},`,
    `Your registration for ${dancers} never made it through to the last step — that was a glitch on our side, not anything you did. Some people were signed out part-way through and sent back to the login page. It's fixed now, so here's a fresh link:`,
    button(link, 'Finish my registration'),
    `If the button doesn't work, copy this link into your browser:<br><a href="${link}">${link}</a>`,
    `Everything Debbie already has on file — ${onFile} — is filled in and waiting. You just confirm it and choose a password.`,
    `The link works once and expires in about an hour. If it expires, you can get a new one any time from <a href="${SITE}/register">${SITE}/register</a>.`,
  ];
}

async function send(to, subject, lines) {
  const footer =
    `\n<p style="margin-top:24px;font-size:12px;color:#6b7280">This is an automated email &mdash; ` +
    `please do not reply. To reach the school, email ` +
    `<a href="mailto:${SCHOOL_CONTACT_EMAIL}">${SCHOOL_CONTACT_EMAIL}</a>.</p>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html: lines.map((l) => `<p>${l}</p>`).join('\n') + footer,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`);
}

// Everyone still stuck: a pending registration, an auth user, no family account.
const { data: pending } = await admin
  .from('pending_registrations')
  .select('email, parent1_name, dancers')
  .eq('status', 'pending');
const { data: accounts } = await admin
  .from('family_accounts')
  .select('auth_user_id, parent2_auth_user_id');
const linked = new Set(
  (accounts ?? []).flatMap((a) => [a.auth_user_id, a.parent2_auth_user_id].filter(Boolean)),
);
const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const byEmail = new Map((users?.users ?? []).map((u) => [u.email?.toLowerCase(), u]));

for (const row of pending ?? []) {
  const user = byEmail.get(row.email.toLowerCase());
  if (!user || linked.has(user.id)) continue;

  const firstName = (row.parent1_name ?? '').trim().split(/\s+/)[0] || 'there';
  const dancers = (row.dancers ?? [])
    .map((d) => `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim())
    .filter(Boolean)
    .join(' and ');

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: row.email,
    options: { redirectTo: `${SITE}/register/continue` },
  });
  if (error || !data?.properties?.hashed_token) {
    console.error(`FAILED to mint link for ${row.email}: ${error?.message ?? 'no token'}`);
    continue;
  }
  const link =
    `${SITE}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}` +
    `&type=magiclink&next=${encodeURIComponent('/register/continue')}`;
  const subject = 'Finish your MacVoy registration';
  const hasPlan = (row.dancers ?? []).some((d) => Number(d.total_amount) > 0);
  const lines = bodyLines(firstName, dancers || 'your dancer', link, hasPlan);

  if (!SEND) {
    console.log(`\n--- would send to ${row.email} — "${subject}" ---`);
    console.log(lines.join('\n\n').replace(/<[^>]+>/g, ''));
    continue;
  }
  try {
    await send(row.email, subject, lines);
    console.log(`sent to ${row.email}`);
  } catch (err) {
    console.error(`FAILED to send to ${row.email}: ${err.message}`);
  }
}
