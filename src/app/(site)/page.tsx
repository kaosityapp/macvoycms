import Link from 'next/link';

export default function WelcomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/gallery/group.jpg')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-brand-ink/70" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center text-white sm:py-32">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">Fáilte!</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Welcome to MacVoy School of Irish Dance</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/90">
            Competitive and recreational programs for boys and girls ages 3+ and adults in
            Mississauga and Pickering.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="rounded-md bg-brand-pink px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-pinkdark"
            >
              Register for Classes
            </Link>
            <Link
              href="/classes"
              className="rounded-md bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/20"
            >
              View Classes
            </Link>
          </div>
        </div>
      </section>

      {/* Season info */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-2xl border border-brand-ink/10 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-brand-pink">Join us for the 2026–2027 dance season!</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-brand-ink">Mississauga</h3>
              <p className="mt-1 text-brand-ink/70">Classes on Tuesday evenings.</p>
            </div>
            <div>
              <h3 className="font-semibold text-brand-ink">Pickering</h3>
              <p className="mt-1 text-brand-ink/70">Classes on Monday and Thursday evenings.</p>
            </div>
          </div>
          <p className="mt-6 text-brand-ink/80">
            Fall registration opens <strong>Wednesday, August 19th 2026</strong>. New students are
            welcome at any time.
          </p>
        </div>
      </section>

      {/* Quote */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <blockquote className="text-xl font-medium italic text-brand-ink sm:text-2xl">
            “Great dancers are not great because of their technique, they are great because of their
            passion.”
          </blockquote>
          <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-brand-ink/50">
            — Martha Graham
          </p>
        </div>
      </section>
    </>
  );
}
