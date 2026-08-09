import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isHelcimConfigured } from '@/lib/integrations/helcim';
import { summarizePayments } from '@/lib/admin/paymentStatus';
import { todayIso } from '@/lib/billing/dueDates';
import { money, formatDateShort, formatDateLong, formatTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const today = todayIso();
  const in7 = addDays(today, 7);
  const billingActive = isHelcimConfigured();

  const [dancerCountRes, locEnrRes, newRegsRes, payRes, upcomingRes] = await Promise.all([
    supabase.from('family_members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('enrollments')
      .select('family_member_id, class:classes(location:locations(name))')
      .eq('status', 'active'),
    supabase
      .from('family_members')
      .select('id, first_name, last_name, created_at, enrollments(status, class:classes(name))')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('family_members')
      .select(
        'id, first_name, last_name, payment_plans(total_amount, installment_schedule, status), payments(amount, paid_at)',
      )
      .eq('status', 'active'),
    supabase
      .from('class_sessions')
      .select('id, session_date, start_time, class:classes(name, location:locations(name))')
      .gte('session_date', today)
      .lte('session_date', in7)
      .neq('status', 'removed')
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ]);

  const dancerCount = dancerCountRes.count ?? 0;

  // Dancers per location (distinct members with an active enrollment there).
  const perLocation = new Map<string, Set<string>>();
  for (const e of (locEnrRes.data ?? []) as any[]) {
    const loc = e.class?.location?.name;
    if (!loc) continue;
    if (!perLocation.has(loc)) perLocation.set(loc, new Set());
    perLocation.get(loc)!.add(e.family_member_id);
  }
  const mississauga = perLocation.get('Mississauga')?.size ?? 0;
  const pickering = perLocation.get('Pickering')?.size ?? 0;

  const newRegs = ((newRegsRes.data ?? []) as any[]).map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`,
    date: m.created_at?.slice(0, 10) ?? today,
    classes: (m.enrollments ?? [])
      .filter((e: any) => e.status === 'active' && e.class)
      .map((e: any) => e.class.name),
  }));

  // Payments: due + late from each active dancer's plan.
  const due: { name: string; date: string; amount: number }[] = [];
  const late: { name: string; total: number; date: string }[] = [];
  for (const m of (payRes.data ?? []) as any[]) {
    const plan = (m.payment_plans ?? []).find((p: any) => p.status === 'active') ?? null;
    const s = summarizePayments(plan, m.payments ?? [], today, billingActive);
    const name = `${m.first_name} ${m.last_name}`;
    if (s.status === 'overdue') late.push({ name, total: s.total - s.paid, date: s.nextPaymentDate ?? today });
    if (s.nextPaymentDate) due.push({ name, date: s.nextPaymentDate, amount: s.nextPaymentAmount ?? 0 });
  }
  due.sort((a, b) => a.date.localeCompare(b.date));
  const dueTotal = due.reduce((sum, d) => sum + d.amount, 0);

  const upcoming = (upcomingRes.data ?? []) as any[];

  const cards = [
    { label: 'Total dancers', value: dancerCount },
    { label: 'Mississauga', value: mississauga },
    { label: 'Pickering', value: pickering },
    { label: 'Classes (next 7 days)', value: upcoming.length },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-pink">Admin overview</h1>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-brand-ink/10 bg-white p-5">
            <div className="text-3xl font-bold text-brand-pink">{c.value}</div>
            <div className="mt-1 text-sm text-brand-ink/60">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Late payment alerts */}
      {late.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5">
          <h2 className="text-lg font-semibold text-red-700">Late payments ({late.length})</h2>
          <ul className="mt-2 divide-y divide-red-100 text-sm">
            {late.map((l, i) => (
              <li key={i} className="flex items-center justify-between py-1.5">
                <span className="text-brand-ink">{l.name}</span>
                <span className="text-red-700">
                  {money(l.total)} · due {formatDateShort(l.date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* New registrations */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-brand-pink">New registrations</h2>
          <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
            {newRegs.length === 0 && <p className="px-5 py-4 text-sm text-brand-ink/60">None yet.</p>}
            {newRegs.map((r) => (
              <Link
                key={r.id}
                href={`/admin/families/${r.id}`}
                className="block px-5 py-3 hover:bg-brand-pink/5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-brand-ink">{r.name}</span>
                  <span className="text-xs text-brand-ink/50">{formatDateShort(r.date)}</span>
                </div>
                <div className="text-sm text-brand-ink/60">
                  {r.classes.length ? r.classes.join(', ') : 'No classes yet'}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Payments due */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-brand-pink">Payments due</h2>
            {due.length > 0 && <span className="text-sm text-brand-ink/60">{money(dueTotal)} total</span>}
          </div>
          <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
            {due.length === 0 && <p className="px-5 py-4 text-sm text-brand-ink/60">Nothing scheduled.</p>}
            {due.slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-brand-ink">{p.name}</span>
                <span className="text-brand-ink/70">
                  {money(p.amount)} · {formatDateShort(p.date)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Upcoming classes */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Upcoming classes — next 7 days</h2>
        <div className="divide-y divide-brand-ink/10 rounded-lg border border-brand-ink/10 bg-white">
          {upcoming.length === 0 && (
            <p className="px-5 py-4 text-sm text-brand-ink/60">No classes this week.</p>
          )}
          {upcoming.slice(0, 20).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
              <span className="text-brand-ink">{s.class?.name}</span>
              <span className="text-right text-brand-ink/60">
                {formatDateLong(s.session_date)} · {formatTime(s.start_time)}
                {s.class?.location?.name ? ` · ${s.class.location.name}` : ''}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-brand-pink">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <QuickLink href="/admin/seasons">Manage seasons &amp; classes</QuickLink>
          <QuickLink href="/admin/families">View dancers</QuickLink>
          <QuickLink href="/admin/announcements/new">Send an announcement</QuickLink>
          <QuickLink href="/admin/payments">Payments &amp; export</QuickLink>
        </div>
      </section>
    </div>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink hover:bg-brand-pink/5"
    >
      {children}
    </Link>
  );
}
