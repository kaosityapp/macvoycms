export const metadata = { title: 'Links — MacVoy School of Irish Dance' };

const LINKS = [
  { label: 'An Coimisiún Rince Le Gaelacha (CLRG)', href: 'http://clrg.ie/' },
  { label: 'Irish Dance Teachers Association of Canada — Eastern Region', href: 'https://www.idtac-er.com/' },
  { label: 'Irish Dance Teachers Association of North America', href: 'http://idtana.org/' },
];

export default function LinksPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-brand-pink">Links</h1>
      <p className="mt-3 text-brand-ink/70">Governing bodies and associations.</p>

      <ul className="mt-8 space-y-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border border-brand-ink/10 bg-white px-5 py-4 font-medium text-brand-ink transition hover:border-brand-pink/40 hover:text-brand-pink"
            >
              {l.label}
              <span aria-hidden>↗</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
