import * as Sentry from '@sentry/nextjs';

// Server-side Sentry init. Only active in production so local/dev noise and
// the free-tier quota aren't consumed during development.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
});
