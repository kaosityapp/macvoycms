# Deploying to Vercel

The repo is git-ready with a clean initial commit. These are the steps that
need your GitHub + Vercel accounts (they can't be automated headlessly).

## 1. Push to GitHub

Create an empty repo (private) under the account/org that will own this, then:

```bash
git remote add origin https://github.com/<you>/macvoy-platform.git
git push -u origin main
```

## 2. Import into Vercel

1. Vercel dashboard → **Add New → Project** → import the GitHub repo.
2. Framework preset auto-detects **Next.js**. Leave build/output defaults.
3. Before the first deploy, add the environment variables below.

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Copy these from your local `.env.local`, with **one change**: point
`NEXT_PUBLIC_SITE_URL` at the deployed URL.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same as local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as local |
| `SUPABASE_SERVICE_ROLE_KEY` | secret — same as local |
| `NEXT_PUBLIC_SITE_URL` | **`https://<your-vercel-domain>`** (or custom domain) |
| `HELCIM_API_TOKEN` / `HELCIM_WEBHOOK_SECRET` | when wiring payments |
| `LOOPS_API_KEY` | for email |
| `LOOPS_FROM_TRANSACTIONAL` / `LOOPS_FROM_ANNOUNCEMENTS` | sending identities |
| `LOOPS_TID_REGISTRATION` / `LOOPS_TID_ANNOUNCEMENT` / `LOOPS_TID_RECEIPT` | Loops template ids |
| `NEXT_PUBLIC_SENTRY_DSN` | error monitoring |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | optional — enables readable stack traces (source-map upload) |

## 4. Point Supabase Auth at the deployed domain

Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://<your-vercel-domain>`
- **Redirect URLs**: add `https://<your-vercel-domain>/auth/callback`

(Without this, password-reset links won't complete.)

## 5. Post-deploy wiring

- **Helcim webhook**: in Helcim, set the webhook URL to
  `https://<your-vercel-domain>/api/webhooks/helcim` and copy its verifier
  secret into `HELCIM_WEBHOOK_SECRET`. (Handler is added in the Helcim phase.)
- **Loops sending domain**: verify `macvoyirishdance.com` in Loops (DNS records)
  and create the transactional templates, then fill the `LOOPS_TID_*` vars.
- **Custom domain**: when ready to go live, add `macvoyirishdance.com` in Vercel
  and update `NEXT_PUBLIC_SITE_URL` + the Supabase URLs to match.

## Schema changes after launch

Migrations live in `supabase/migrations/`. They've already been applied to the
`macvoy` project. For future changes, add a new numbered migration and apply it
(via the Supabase SQL editor or CLI), then regenerate types with
`npm run db:types`.
