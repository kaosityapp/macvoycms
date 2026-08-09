'use client';

import { useEffect } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

/** Official Instagram single-post embed (blockquote + embed.js) — no API key
 *  or connected account needed, works for any public post. */
export function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    window.instgrm?.Embeds.process();
  }, []);

  return (
    <>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ margin: 0, width: '100%' }}
      />
      <Script
        src="https://www.instagram.com/embed.js"
        strategy="afterInteractive"
        onLoad={() => window.instgrm?.Embeds.process()}
      />
    </>
  );
}
