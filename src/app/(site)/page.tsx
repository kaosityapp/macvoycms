import Link from 'next/link';

export default function WelcomePage() {
  return (
    <>
      {/* Hero — logo-centered, no background photo */}
      <section className="mx-auto max-w-2xl px-6 pb-16 pt-16 text-center sm:pb-20 sm:pt-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo.png"
          alt="MacVoy School of Irish Dance"
          className="mx-auto h-36 w-auto sm:h-44"
        />

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.3em] text-brand-pink">
          Fáilte!
        </p>
        <h1 className="mt-3 text-3xl font-bold text-brand-ink sm:text-4xl">
          Welcome to MacVoy School of Irish Dance!
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-ink/80">
          Competitive and recreational programs for boys and girls ages 3+ and adults in
          Mississauga and Pickering.
        </p>

        <h2 className="mt-10 text-xl font-bold text-brand-pink">
          Join us for 2026&ndash;2027 dance season!
        </h2>
        <div className="mx-auto mt-4 max-w-xl space-y-2 text-brand-ink/80">
          <p>Mississauga classes on Tuesday evenings.</p>
          <p>Pickering classes on Monday and Thursday evenings.</p>
          <p>
            Fall registration will open on <strong>Wednesday, August 19th 2026</strong>.
          </p>
          <p>New students are welcome at any time.</p>
        </div>

        <Link
          href="/register"
          className="mt-8 inline-block rounded-md bg-brand-pink px-8 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-pinkdark"
        >
          Register
        </Link>
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
