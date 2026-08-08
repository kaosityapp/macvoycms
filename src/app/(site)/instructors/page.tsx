export const metadata = { title: 'Instructors — MacVoy School of Irish Dance' };

export default function InstructorsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-bold text-brand-pink">Instructors</h1>

      <div className="mt-10 space-y-12">
        {/* Debbie */}
        <article className="grid gap-6 sm:grid-cols-[200px_1fr] sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/debbie.jpg"
            alt="Debbie MacVoy"
            className="w-full rounded-lg object-cover shadow-sm"
          />
          <div>
            <h2 className="text-xl font-bold text-brand-ink">Debbie MacVoy</h2>
            <p className="text-sm font-semibold text-brand-pink">
              Director and Lead Instructor, T.C.R.G., A.D.C.R.G.
            </p>
            <div className="mt-4 space-y-3 text-brand-ink/80">
              <p>
                Debbie started Irish dancing at age 4 and competed for 15 years until retiring from
                Championship level in 2001. Her achievements included a top 5 finish at the Eastern
                Canadian Oireachtas and top 14 at North American Nationals, plus multiple overseas
                competitions at World and All Ireland Championships.
              </p>
              <p>
                She began teaching in 2009, earned her T.C.R.G. certification in March 2012, and her
                A.D.C.R.G. adjudicator certificate in December 2017. She holds memberships with
                I.D.T.A.C.-E, I.D.T.A.N.A., and C.L.R.G. Dublin. She is First Aid &amp; CPR trained
                and completed child protection training.
              </p>
            </div>
          </div>
        </article>

        {/* Casey */}
        <article className="grid gap-6 sm:grid-cols-[200px_1fr] sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/casey.jpg"
            alt="Casey Baillargeon"
            className="w-full rounded-lg object-cover shadow-sm"
          />
          <div>
            <h2 className="text-xl font-bold text-brand-ink">Casey Baillargeon</h2>
            <p className="text-sm font-semibold text-brand-pink">Assistant Teacher</p>
            <div className="mt-4 space-y-3 text-brand-ink/80">
              <p>
                Casey began Irish dancing at 18 with her aunt Debbie and currently dances at Adult
                Championship level. In 2024, she placed 4th at the Eastern Canadian Regional
                Oireachtas (Adult Premiere category) and competed at the 2025 North American Irish
                Dance Championships in Maryland with her 4-Hand Team.
              </p>
              <p>
                She has assisted with teaching since 2023 and is working toward her Irish dance
                teaching certification. Outside the studio, she enjoys snowboarding, hiking with her
                dog Myles, and works as a first responder/emergency dispatcher. She is First Aid &amp;
                CPR trained.
              </p>
            </div>
          </div>
        </article>
      </div>

      <p className="mt-12 border-t border-brand-ink/10 pt-8 text-center text-lg font-medium italic text-brand-ink/80">
        “Dance with your heart and your feet will follow.”
      </p>
    </div>
  );
}
