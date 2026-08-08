import type { SupabaseClient } from '@supabase/supabase-js';
import { durationMinutes } from '@/lib/season';
import { computeTuition, quarterlySchedule, paidInFullSchedule } from '@/lib/billing/tuition';
import { defaultQuarterlyDueDates, todayIso } from '@/lib/billing/dueDates';

/**
 * Recompute a dancer's tuition from the rate card and update their active
 * default plan (spec §7 "reassigning a class auto-recalculates tuition").
 *
 * Custom plans are left untouched — Debbie set those deliberately. Quarterly
 * plans keep their existing 4 due dates and redistribute the new total;
 * pay-in-full keeps its single due date.
 *
 * Returns the new tuition total.
 */
export async function recalcDefaultPlanForMember(
  supabase: SupabaseClient,
  memberId: string,
): Promise<number> {
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('classes(start_time, end_time, season_id)')
    .eq('family_member_id', memberId)
    .eq('status', 'active');

  const classes = ((enrollments ?? []) as any[]).map((e) => e.classes).filter(Boolean);
  const seasonId = classes[0]?.season_id as string | undefined;

  const { data: rates } = await supabase
    .from('rate_card')
    .select('duration_minutes, price')
    .eq('season_id', seasonId ?? '');
  const rateMap = new Map((rates ?? []).map((r: any) => [r.duration_minutes, Number(r.price)]));

  const tuition = computeTuition(
    classes.map((c: any) => ({
      classId: '',
      durationMinutes: durationMinutes(c.start_time, c.end_time),
    })),
    rateMap,
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
