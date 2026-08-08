export const metadata = { title: 'Contact — MacVoy School of Irish Dance' };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-brand-pink">Contact</h1>
      <p className="mt-3 text-brand-ink/70">
        Visit our social media pages, or send us an email for more information.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-brand-ink/10 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-brand-ink">Email</h2>
          <a href="mailto:info@macvoyirishdance.com" className="mt-2 inline-block text-brand-pink hover:underline">
            info@macvoyirishdance.com
          </a>
          <p className="mt-4 text-sm text-brand-ink/60">
            Registration inquiries can be directed to Debbie MacVoy, Instructor.
          </p>
        </div>

        <div className="rounded-lg border border-brand-ink/10 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-brand-ink">Social media</h2>
          <ul className="mt-2 space-y-2">
            <li>
              <a href="https://facebook.com/macvoyirishdance" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">
                facebook.com/macvoyirishdance
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/macvoyschoolofirishdance/" target="_blank" rel="noopener noreferrer" className="text-brand-pink hover:underline">
                instagram.com/macvoyschoolofirishdance
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-lg bg-brand-pink/5 p-6 text-center">
        <p className="text-brand-ink/80">Ready to join? Registration is quick and online.</p>
        <a
          href="/register"
          className="mt-4 inline-block rounded-md bg-brand-pink px-6 py-3 font-semibold text-white hover:bg-brand-pinkdark"
        >
          Register for Classes
        </a>
      </div>
    </div>
  );
}
