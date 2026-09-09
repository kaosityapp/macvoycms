import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Supabase Storage public assets (CMS-managed uploads).
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async rewrites() {
    return {
      // Must run in beforeFiles: '/' already resolves to the real homepage
      // route, so a plain (afterFiles) rewrite never gets a chance to
      // intercept it — Next.js serves the matching page first.
      beforeFiles: [
        // Helcim's webhook Deliver URL field rejects ANY url with a path
        // segment (even a single short one) with a generic "urlformat"
        // error — it only accepts a bare host. So the Deliver URL is the
        // bare subdomain hooks.macvoyirishdance.com, rewritten here to the
        // real handler. A rewrite (not a redirect) is transparent —
        // method/body/headers reach the handler unchanged, so signature
        // verification still sees the exact same request Helcim sent.
        {
          source: '/',
          has: [{ type: 'host', value: 'hooks.macvoyirishdance.com' }],
          destination: '/api/webhooks/helcim',
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withSentryConfig(nextConfig, {
  // Org/project are only needed to upload source maps at build time; set them
  // (plus SENTRY_AUTH_TOKEN) in Vercel to get readable stack traces. Without a
  // token, the build simply skips the upload.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
