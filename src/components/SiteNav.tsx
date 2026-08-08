'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const LINKS = [
  { href: '/', label: 'Welcome' },
  { href: '/instructors', label: 'Instructors' },
  { href: '/locations', label: 'Locations' },
  { href: '/classes', label: 'Classes' },
  { href: '/photos', label: 'Photos' },
  { href: '/links', label: 'Links' },
  { href: '/contact', label: 'Contact' },
  { href: '/events', label: 'Events' },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setAuthed(Boolean(data.user)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setAuthed(Boolean(session?.user)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const account = authed ? { href: '/dashboard', label: 'My Account' } : { href: '/login', label: 'Login' };

  const registerBtn =
    'rounded-md bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-pinkdark';
  const accountBtn =
    'rounded-md border border-brand-ink px-4 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-ink hover:text-white';

  return (
    <nav className="text-sm">
      {/* Desktop */}
      <div className="hidden items-center gap-1 lg:flex">
        <ul className="flex items-center gap-0.5">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`rounded-md px-2.5 py-2 font-medium transition ${
                  isActive(l.href) ? 'text-brand-pink' : 'text-brand-ink/70 hover:text-brand-pink'
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-3 flex items-center gap-2">
          <Link href="/register" className={registerBtn}>
            Register
          </Link>
          <Link href={account.href} className={accountBtn}>
            {account.label}
          </Link>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2">
          <Link href="/register" className={registerBtn}>
            Register
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="rounded-md p-2 text-brand-ink hover:bg-brand-ink/5"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {open && (
          <ul className="absolute left-0 right-0 z-20 mt-3 space-y-1 border-t border-brand-ink/10 bg-white px-4 pb-4 pt-3 shadow-lg">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-2 font-medium ${
                    isActive(l.href) ? 'bg-brand-pink/10 text-brand-pink' : 'text-brand-ink/80'
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href={account.href}
                onClick={() => setOpen(false)}
                className="block rounded-md border border-brand-ink px-3 py-2 text-center font-semibold text-brand-ink"
              >
                {account.label}
              </Link>
            </li>
          </ul>
        )}
      </div>
    </nav>
  );
}
