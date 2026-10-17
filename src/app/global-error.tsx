'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';

// A new deploy rotates server action IDs. If a visitor has a page open across
// a deploy and then submits a form, their browser posts an action ID that no
// longer exists on the server. Reload once to pick up the current build
// instead of reporting it as a real error — the reload timestamp guards
// against looping if the reload itself doesn't resolve it.
const STALE_DEPLOY_PATTERN = /Failed to find Server Action|was not found on the server/i;
const RELOAD_FLAG = 'macvoy-stale-deploy-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const isStaleDeploy = STALE_DEPLOY_PATTERN.test(error.message);
  const [reloading, setReloading] = useState(isStaleDeploy);

  useEffect(() => {
    if (isStaleDeploy) {
      const now = Date.now();
      const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      if (now - lastReload > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_FLAG, String(now));
        window.location.reload();
        return;
      }
    }
    setReloading(false);
    Sentry.captureException(error);
  }, [error, isStaleDeploy]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          color: '#1a1a1a',
          background: '#fefefe',
        }}
      >
        <div>
          {reloading ? (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Updating…</h1>
              <p style={{ marginTop: '0.75rem', color: '#555' }}>Loading the latest version of the site.</p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
              <p style={{ marginTop: '0.75rem', color: '#555' }}>
                Please refresh the page. If the problem continues, contact us at
                macvoyirishdance@rogers.com.
              </p>
            </>
          )}
        </div>
      </body>
    </html>
  );
}
