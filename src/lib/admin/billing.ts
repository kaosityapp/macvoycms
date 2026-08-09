import type { SupabaseClient } from '@supabase/supabase-js';
import { durationMinutes } from '@/lib/season';
import { computeTuition, quarterlySchedule, paidInFullSchedule } from '@/lib/billing/tuition';
import { defaultQuarterlyDueDates, todayIso } from '@/lib/billing/dueDates';

/**
 * Recompute a dancer's tuition (hourly_rate × hours × total_sessions across
 * active enrollments) and update their active default plan. Custom plans are
 * left untouched. Returns the new total.
 */
export async function recalcDefaultPlanForMember(
  supabase: SupabaseClient,
  memberId: string,
): Promise<number> {
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('classes(id, start_time, end_time, hourly_rate, total_sessions)')
    .eq('family_member_id', memberId)
    .eq('status', 'active');

  const classes = ((enrollments ?? []) as any[]).map((e) => e.classes).filter(Boolean);

  const tuition = computeTuition(
    classes.map((c: any) => ({
      classId: c.id,
      hourlyRate: c.hourly_rate,
      durationMinutes: durationMinutes(c.start_time, c.end_time),
      totalSessions: c.total_sessions,
    })),
  );

  const { data: plan } = await supabase
    .from('payment_plans')
    .select('id, plan_type, installment_schedule')
    .eq('family_member_id', memberId)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan || plan.plan_type === 'custom') return tuition.total;

  const existing = Array.isArray(plan.installment_schedule) ? plan.installment_schedule : [];
  let schedule;
  if (plan.plan_type === 'quarterly') {
    const dates =
      existing.length === 4 ? existing.map((i: any) => i.date) : defaultQuarterlyDueDates(todayIso());
    schedule = quarterlySchedule(tuition.total, dates);
  } else {
    const date = existing[0]?.date ?? todayIso();
    schedule = paidInFullSchedule(tuition.total, date);
  }

  await supabase
    .from('payment_plans')
    .update({ total_amount: tuition.total, installment_schedule: schedule })
    .eq('id', plan.id);

  return tuition.total;
}

/** Recalculate default plans for every dancer actively enrolled in a class. */
export async function recalcMembersOfClass(
  supabase: SupabaseClient,
  classId: string,
): Promise<void> {
  const { data } = await supabase
    .from('enrollments')
    .select('family_member_id')
    .eq('class_id', classId)
    .eq('status', 'active');

  const memberIds = [...new Set((data ?? []).map((e: any) => e.family_member_id))];
  for (const id of memberIds) {
    await recalcDefaultPlanForMember(supabase, id);
  }
}
