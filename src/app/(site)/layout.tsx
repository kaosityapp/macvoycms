import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <header className="relative border-b border-brand-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="MacVoy School of Irish Dance" className="h-14 w-auto" />
            <span className="sr-only">MacVoy School of Irish Dance</span>
          </Link>
          <SiteNav />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-brand-ink/10 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-brand-ink/70">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div>
              <div className="font-semibold text-brand-ink">MacVoy School of Irish Dance</div>
              <p className="mt-1">Mississauga &amp; Pickering, Ontario</p>
              <a href="mailto:info@macvoyirishdance.com" className="text-brand-pink hover:underline">
                info@macvoyirishdance.com
              </a>
            </div>
            <div className="flex gap-4">
              <a href="https://facebook.com/macvoyirishdance" target="_blank" rel="noopener noreferrer" className="hover:text-brand-pink">
                Facebook
              </a>
              <a href="https://instagram.com/macvoyirishdance" target="_blank" rel="noopener noreferrer" className="hover:text-brand-pink">
                Instagram
              </a>
              <Link href="/dashboard" className="hover:text-brand-pink">
                My Account
              </Link>
            </div>
          </div>
          <p className="mt-6 text-xs text-brand-ink/50">
            © {new Date().getFullYear()} MacVoy School of Irish Dance. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
