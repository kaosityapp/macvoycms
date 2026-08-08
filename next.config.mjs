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
