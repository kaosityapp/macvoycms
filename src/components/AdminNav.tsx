'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/seasons', label: 'Seasons & Classes' },
  { href: '/admin/families', label: 'Families' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/payments', label: 'Payments' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === '/admin' ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-brand-pinkdark text-brand-ink'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
