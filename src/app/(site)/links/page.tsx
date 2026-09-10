export const metadata = {
  title: 'Links',
  description: 'Irish dance governing bodies and teacher associations affiliated with MacVoy School of Irish Dance.',
};

const LINKS = [
  { label: 'An Coimisiún Rince Le Gaelacha', href: 'http://clrg.ie/', logo: '/images/logos/clrg.jpg' },
  {
    label: 'Irish Dance Teachers Association of Canada — Eastern Region',
    href: 'https://www.idtac-er.com/',
    logo: '/images/logos/idtac.jpg',
  },
  {
    label: 'Irish Dance Teachers Association of North America',
    href: 'http://idtana.org/',
    logo: '/images/logos/idtana.webp',
  },
];

export default function LinksPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold text-brand-pink">Links</h1>
      <p className="mt-3 text-brand-ink/70">Governing bodies and associations.</p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-4 rounded-lg border border-brand-ink/10 bg-white p-6 text-center transition hover:border-brand-pink/40 hover:shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.logo} alt={`${l.label} logo`} className="h-24 w-auto object-contain" />
            <span className="font-semibold text-brand-ink">{l.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
