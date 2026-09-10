import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const SITE_URL = 'https://www.macvoyirishdance.com';
const SITE_NAME = 'MacVoy School of Irish Dance';
const DESCRIPTION =
  'Competitive and recreational Irish dance programs for boys and girls ages 3+ and adults in Mississauga and Pickering, Ontario. Soft shoe, hard shoe, and competitive classes — new students welcome year-round.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Mississauga & Pickering`,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    'Irish dance',
    'Irish dance lessons',
    'Irish dance classes',
    'Mississauga Irish dance',
    'Pickering Irish dance',
    'competitive Irish dance',
    'feis',
    'Irish step dance Ontario',
  ],
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Mississauga & Pickering`,
    description: DESCRIPTION,
    locale: 'en_CA',
    images: [{ url: '/images/logo.png', width: 267, height: 247, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} — Mississauga & Pickering`,
    description: DESCRIPTION,
    images: ['/images/logo.png'],
  },
  alternates: { canonical: '/' },
};

// Structured data — helps both classic search rich results and AI
// answer/generative engines cite accurate facts (name, locations, program
// type) rather than guessing. Kept to verifiable facts already on the site.
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
  image: `${SITE_URL}/images/logo.png`,
  description: DESCRIPTION,
  email: 'macvoyirishdance@rogers.com',
  sameAs: ['https://facebook.com/macvoyirishdance', 'https://www.instagram.com/macvoyschoolofirishdance/'],
  areaServed: ['Mississauga, Ontario', 'Pickering, Ontario'],
  location: [
    {
      '@type': 'Place',
      name: 'MacVoy School of Irish Dance — Mississauga',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '4120 Ridgeway Drive, Unit #39',
        addressLocality: 'Mississauga',
        addressRegion: 'ON',
        addressCountry: 'CA',
      },
    },
    {
      '@type': 'Place',
      name: 'MacVoy School of Irish Dance — Pickering',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '1895 Clements Road, Unit #153',
        addressLocality: 'Pickering',
        addressRegion: 'ON',
        addressCountry: 'CA',
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {children}
      </body>
    </html>
  );
}
