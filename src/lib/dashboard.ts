import { createClient } from '@/lib/supabase/server';
import { getAddon } from '@/lib/constants/addons';

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
  planId: string;
  planType: string;
  installmentIndex: number;
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
    .neq('status', 'removed')
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
    .in('status', ['scheduled', 'rescheduled'])
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
    .select(
      'id, first_name, last_name, payment_plans(id, plan_type, status, installment_schedule, payments(amount, paid_at))',
    )
    .eq('family_account_id', accountId);

  const out: Installment[] = [];
  for (const m of (data ?? []) as any[]) {
    for (const plan of m.payment_plans ?? []) {
      if (plan.status !== 'active') continue;
      const schedule = Array.isArray(plan.installment_schedule) ? plan.installment_schedule : [];
      // Net against what's actually been paid (Helcim, ACH, or a manual
      // entry) — otherwise an installment already covered by a lump-sum or
      // manual payment still shows a live "Pay Now" button, risking a
      // duplicate payment.
      const paidTotal = ((plan.payments ?? []) as any[])
        .filter((p) => p.paid_at)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      let cumulative = 0;
      schedule.forEach((item: any, idx: number) => {
        cumulative += Number(item?.amount ?? 0);
        if (!item?.date || item.date < todayIso) return;
        if (paidTotal >= cumulative - 0.005) return; // already covered
        out.push({
          memberId: m.id,
          memberName: `${m.first_name} ${m.last_name}`,
          planId: plan.id,
          planType: plan.plan_type,
          installmentIndex: idx,
          date: item.date,
          amount: Number(item.amount ?? 0),
        });
      });
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

export interface AutoChargePlan {
  planId: string;
  memberName: string;
}

/** Plans with automatic recurring charges enabled, for the opt-out UI. */
export async function getAutoChargePlans(accountId: string): Promise<AutoChargePlan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('family_members')
    .select('first_name, last_name, payment_plans(id, status, auto_charge)')
    .eq('family_account_id', accountId);

  const out: AutoChargePlan[] = [];
  for (const m of (data ?? []) as any[]) {
    for (const plan of m.payment_plans ?? []) {
      if (plan.status === 'active' && plan.auto_charge) {
        out.push({ planId: plan.id, memberName: `${m.first_name} ${m.last_name}` });
      }
    }
  }
  return out;
}

export interface PlanBreakdownClass {
  name: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  locationName: string;
}

export interface PlanBreakdownAddon {
  label: string;
  amount: number;
}

export interface ActivePlanBreakdown {
  planId: string;
  memberId: string;
  memberName: string;
  planType: string;
  totalAmount: number;
  classes: PlanBreakdownClass[];
  addons: PlanBreakdownAddon[];
}

/**
 * The Fall Sessions breakdown (classes + add-ons + total) for every dancer
 * with an active plan — a persistent "what you're paying for" reference on
 * the family's Payments page.
 */
export async function getActivePlanBreakdowns(accountId: string): Promise<ActivePlanBreakdown[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('family_members')
    .select(
      `id, first_name, last_name,
       payment_plans(id, status, plan_type, total_amount),
       enrollments(status, class:classes(name, day_of_week, start_time, end_time, location:locations(name))),
       order_items(item_type, amount)`,
    )
    .eq('family_account_id', accountId);

  const out: ActivePlanBreakdown[] = [];
  for (const m of (data ?? []) as any[]) {
    for (const plan of m.payment_plans ?? []) {
      if (plan.status !== 'active') continue;
      const classes: PlanBreakdownClass[] = (m.enrollments ?? [])
        .filter((e: any) => e.status === 'active' && e.class)
        .map((e: any) => ({
          name: e.class.name,
          dayOfWeek: e.class.day_of_week,
          startTime: e.class.start_time,
          endTime: e.class.end_time,
          locationName: e.class.location?.name ?? '',
        }));
      const addons: PlanBreakdownAddon[] = (m.order_items ?? []).map((item: any) => ({
        label: getAddon(item.item_type)?.label ?? item.item_type,
        amount: Number(item.amount),
      }));
      out.push({
        planId: plan.id,
        memberId: m.id,
        memberName: `${m.first_name} ${m.last_name}`,
        planType: plan.plan_type,
        totalAmount: Number(plan.total_amount),
        classes,
        addons,
      });
    }
  }
  return out;
}

/**
 * Announcements visible to the current family (RLS already filters), capped
 * to the last 30 days — older ones no longer show anywhere in the parent
 * dashboard.
 */
export async function getAnnouncements() {
  const supabase = await createClient();
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase
    .from('announcements')
    .select('id, subject, body, sender, sent_at')
    .not('sent_at', 'is', null)
    .gte('sent_at', thirtyDaysAgoIso)
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
