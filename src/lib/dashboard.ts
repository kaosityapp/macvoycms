import { createClient } from '@/lib/supabase/server';

export interface ActiveEnrollment {
  memberId: string;
  memberFirstName: string;
  memberLastName: string;
  classId: string;
  className: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  locationName: string;
}

export interface SessionEntry {
  id: string;
  classId: string;
  className: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: string;
  note: string | null;
}

export interface Installment {
  memberId: string;
  memberName: string;
  planType: string;
  date: string;
  amount: number;
}

export interface Receipt {
  id: string;
  memberName: string;
  amount: number;
  category: string;
  paidAt: string | null;
}

/** All active enrollments across a family's dancers, flattened. */
export async function getActiveEnrollments(accountId: string): Promise<ActiveEnrollment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('family_members')
    .select(
      `id, first_name, last_name,
       enrollments(status, class:classes(id, name, day_of_week, start_time, end_time, location:locations(name)))`,
    )
    .eq('family_account_id', accountId);

  const rows: ActiveEnrollment[] = [];
  for (const member of (data ?? []) as any[]) {
    for (const e of member.enrollments ?? []) {
      if (e.status !== 'active' || !e.class) continue;
      rows.push({
        memberId: member.id,
        memberFirstName: member.first_name,
        memberLastName: member.last_name,
        classId: e.class.id,
        className: e.class.name,
        dayOfWeek: e.class.day_of_week,
        startTime: e.class.start_time,
        endTime: e.class.end_time,
        locationName: e.class.location?.name ?? '',
      });
    }
  }
  return rows;
}

/** Sessions for the given classes within [firstIso, lastIso]. */
export async function getSessionsInRange(
  classIds: string[],
  firstIso: string,
  lastIso: string,
): Promise<SessionEntry[]> {
  if (classIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('class_sessions')
    .select('id, class_id, session_date, start_time, end_time, status, note, class:classes(name)')
    .in('class_id', classIds)
    .gte('session_date', firstIso)
    .lte('session_date', lastIso)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true });

  return ((data ?? []) as any[]).map((s) => ({
    id: s.id,
    classId: s.class_id,
    className: s.class?.name ?? 'Class',
    sessionDate: s.session_date,
    startTime: s.start_time,
    endTime: s.end_time,
    status: s.status,
    note: s.note,
  }));
}

/** The next upcoming (on/after today) session across a set of classes. */
export async function getNextSession(classIds: string[], todayIso: string): Promise<SessionEntry | null> {
  if (classIds.length === 0) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('class_sessions')
    .select('id, class_id, session_date, start_time, end_time, status, note, class:classes(name)')
    .in('class_id', classIds)
    .gte('session_date', todayIso)
    .eq('status', 'scheduled')
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const s = data as any;
  return {
    id: s.id,
    classId: s.class_id,
    className: s.class?.name ?? 'Class',
    sessionDate: s.session_date,
    startTime: s.start_time,
    endTime: s.end_time,
    status: s.status,
    note: s.note,
  };
}

/** Upcoming installments (date on/after today) from active plans, sorted. */
export async function getUpcomingInstallments(
  accountId: string,
  todayIso: string,
): Promise<Installment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('family_members')
    .select('id, first_name, last_name, payment_plans(plan_type, status, installment_schedule)')
    .eq('family_account_id', accountId);

  const out: Installment[] = [];
  for (const m of (data ?? []) as any[]) {
    for (const plan of m.payment_plans ?? []) {
      if (plan.status !== 'active') continue;
      const schedule = Array.isArray(plan.installment_schedule) ? plan.installment_schedule : [];
      for (const item of schedule) {
        if (!item?.date || item.date < todayIso) continue;
        out.push({
          memberId: m.id,
          memberName: `${m.first_name} ${m.last_name}`,
          planType: plan.plan_type,
          date: item.date,
          amount: Number(item.amount ?? 0),
        });
      }
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Paid receipts across a family's dancers, newest first. */
export async function getReceipts(accountId: string): Promise<Receipt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('family_members')
    .select('id, first_name, last_name, payments(id, amount, category, paid_at)')
    .eq('family_account_id', accountId);

  const out: Receipt[] = [];
  for (const m of (data ?? []) as any[]) {
    for (const p of m.payments ?? []) {
      if (!p.paid_at) continue;
      out.push({
        id: p.id,
        memberName: `${m.first_name} ${m.last_name}`,
        amount: Number(p.amount),
        category: p.category,
        paidAt: p.paid_at,
      });
    }
  }
  out.sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''));
  return out;
}

/** Announcements visible to the current family (RLS already filters). */
export async function getAnnouncements() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('announcements')
    .select('id, subject, body, sender, sent_at')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false });
  return data ?? [];
}

/** IDs of announcements this family has already read. */
export async function getReadAnnouncementIds(accountId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('family_account_id', accountId);
  return new Set((data ?? []).map((r) => r.announcement_id));
}
