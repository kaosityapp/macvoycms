# Deploying

The site runs on Vercel (project **`macvoycms`**, team `nick-2434s-projects`)
and is served at https://www.macvoyirishdance.com, https://macvoyirishdance.com
and https://macvoycms.vercel.app.

## How a change goes live

**Push to `main` and it deploys.** The Vercel project is connected to
`github.com/kaosityapp/macvoycms`, so every push to `main` builds and
publishes production automatically (about a minute). Nothing else to run.

```bash
git push origin main
```

To check that it went out:

```bash
npx vercel ls macvoycms
```

The newest row should be **Ready** / **Production**. If a build fails, see
its log with `npx vercel inspect <deployment-url> --logs`.

### Manual deploy (fallback only)

If GitHub or the connection is ever down, deploy the local checkout directly:

```bash
npx vercel --prod --yes
```

If that says **"Not authorized"** while `npx vercel ls` still works, the CLI
login has gone stale — run `npx vercel logout`, then `npx vercel login` and
approve it in the browser.

There is no Skew Protection (paid option, declined). A family with the site
open during a deploy may hit a stale form once; `global-error.tsx` reloads
the page to recover.

## Environment variables

Set in Vercel → Project → Settings → Environment Variables (Production).
Changing one only takes effect on the **next** deploy.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project `xvdyfrlgrhebiiymvddd` |
| `SUPABASE_SERVICE_ROLE_KEY` | secret |
| `NEXT_PUBLIC_SITE_URL` | `https://www.macvoyirishdance.com` |
| `HELCIM_API_TOKEN` / `HELCIM_WEBHOOK_SECRET` | payments; the secret is the webhook integration's verifier token |
| `CRON_SECRET` | protects `/api/cron/charge-installments` (Vercel sends it automatically) |
| `RESEND_API_KEY` | receipts, reminders and admin alerts |
| `ADMIN_ALERT_EMAILS` | who gets admin alerts |
| `ADMIN_ALERT_FROM` | optional — defaults to `alerts@macvoyirishdance.com` |
| `LOOPS_API_KEY` / `LOOPS_FROM_TRANSACTIONAL` / `LOOPS_FROM_ANNOUNCEMENTS` | Loops sending |
| `NEXT_PUBLIC_SENTRY_DSN` | error monitoring |

In `.env.local`, wrap any value containing `$` or `#` in double quotes and
escape each `$` as `\$`, or Next silently mangles it.

## Scheduled job

`vercel.json` runs `/api/cron/charge-installments` daily at 13:00 UTC
(9am Toronto in summer, 8am in winter). It charges due installments on
saved cards/bank accounts and sends reminders.

## Outside Vercel

- **Supabase Auth → URL Configuration**: Site URL and the `/auth/callback`
  redirect must point at the live domain, or password-reset links won't
  complete. Only changeable in the Supabase dashboard.
- **Helcim webhook**: Card Transactions events deliver to
  `https://hooks.macvoyirishdance.com`, which reaches `/api/webhooks/helcim`.

## Database changes

Migrations live in `supabase/migrations/` (numbered, already applied to the
live project). For a schema change, add the next numbered migration, apply
it to the live project (Supabase SQL editor or CLI), then regenerate
`src/lib/types/database.ts`. Apply the migration **before** pushing code that
depends on it — the push deploys immediately.
