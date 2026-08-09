'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/dancers', label: 'Your Dancers' },
  { href: '/dashboard/calendar', label: 'Calendar' },
  { href: '/dashboard/payments', label: 'Payments' },
  { href: '/dashboard/announcements', label: 'Announcements' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active =
          tab.href === '/dashboard' ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-brand-pink text-white'
                : 'text-brand-ink/70 hover:bg-brand-pink/10 hover:text-brand-ink'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
