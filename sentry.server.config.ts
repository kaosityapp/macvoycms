import * as Sentry from '@sentry/nextjs';

// Server-side Sentry init. Only active in production so local/dev noise and
// the free-tier quota aren't consumed during development.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  // A browser posting a server action ID from an older (or newer) deploy —
  // stale tabs and bots replaying a saved form. Nothing runs, so it's noise
  // here; the client-side reload in global-error.tsx still reports any real
  // visitor it can't recover.
  ignoreErrors: [/Failed to find Server Action/],
});
