'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { recalcDefaultPlanForMember } from '@/lib/admin/billing';
import { isHelcimConfigured, stopSubscription } from '@/lib/integrations/helcim';

export interface ActionState {
  error?: string;
  success?: string;
}

function revalidateDancer(memberId: string) {
  revalidatePath('/admin/families');
  if (memberId) revalidatePath(`/admin/families/${memberId}`);
}

/** Enroll a dancer into a class, then recalc their default plan. */
export async function enrollDancer(formData: FormData): Promise<void> {
  const memberId = String(formData.get('member_id') ?? '');
  const classId = String(formData.get('class_id') ?? '');
  const familyId = String(formData.get('family_id') ?? '');
  if (!memberId || !classId) return;

  const supabase = await createClient();
  await supabase.from('enrollments').insert({ family_member_id: memberId, class_id: classId });
  await recalcDefaultPlanForMember(supabase, memberId);
  revalidateDancer(memberId);
}

/** Remove a dancer from a class (soft), then recalc their default plan. */
export async function removeEnrollment(formData: FormData): Promise<void> {
  const enrollmentId = String(formData.get('enrollment_id') ?? '');
  const memberId = String(formData.get('member_id') ?? '');
  const familyId = String(formData.get('family_id') ?? '');
  if (!enrollmentId) return;

  const supabase = await createClient();
  await supabase.from('enrollments').update({ status: 'removed' }).eq('id', enrollmentId);
  if (memberId) await recalcDefaultPlanForMember(supabase, memberId);
  revalidateDancer(memberId);
}

/** Move a dancer from one class to another; tuition auto-recalculates. */
export async function reassignEnrollment(formData: FormData): Promise<void> {
  const enrollmentId = String(formData.get('enrollment_id') ?? '');
  const newClassId = String(formData.get('new_class_id') ?? '');
  const memberId = String(formData.get('member_id') ?? '');
  const familyId = String(formData.get('family_id') ?? '');
  if (!enrollmentId || !newClassId || !memberId) return;

  const supabase = await createClient();
  // Add the new class FIRST. If it conflicts (already enrolled), bail without
  // touching the old enrollment so the dancer never loses a class silently.
  const { error: insertError } = await supabase
    .from('enrollments')
    .insert({ family_member_id: memberId, class_id: newClassId });
  if (insertError) return;

  await supabase.from('enrollments').update({ status: 'removed' }).eq('id', enrollmentId);
  await recalcDefaultPlanForMember(supabase, memberId);
  revalidateDancer(memberId);
}

/**
 * Stop future billing for a dancer. Halts scheduled charges only — never a
 * refund (spec §3.3). Requires an explicit typed confirmation.
 */
export async function stopBilling(formData: FormData): Promise<void> {
  const memberId = String(formData.get('member_id') ?? '');
  const familyId = String(formData.get('family_id') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (!memberId || confirm !== 'STOP') return;

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from('payment_plans')
    .select('id, helcim_subscription_id')
    .eq('family_member_id', memberId)
    .eq('status', 'active');

  for (const plan of plans ?? []) {
    if (isHelcimConfigured() && plan.helcim_subscription_id) {
      try {
        await stopSubscription(plan.helcim_subscription_id);
      } catch {
        // Leave the plan active if the processor call fails, so state stays honest.
        continue;
      }
    }
    await supabase.from('payment_plans').update({ status: 'stopped' }).eq('id', plan.id);
  }
  revalidateDancer(memberId);
}

/** Create a custom payment plan, superseding the dancer's active default plan. */
export async function createCustomPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get('member_id') ?? '');
  const familyId = String(formData.get('family_id') ?? '');
  if (!memberId) return { error: 'Missing dancer.' };

  const dates = formData.getAll('installment_date').map(String);
  const amounts = formData.getAll('installment_amount').map(String);
  const schedule: { date: string; amount: number }[] = [];
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]?.trim();
    const amount = Number(amounts[i]);
    if (date && Number.isFinite(amount) && amount > 0) schedule.push({ date, amount });
  }
  if (schedule.length === 0) {
    return { error: 'Add at least one installment with a date and amount.' };
  }

  const totalField = Number(formData.get('total_amount'));
  const total = Number.isFinite(totalField) && totalField > 0
    ? totalField
    : schedule.reduce((sum, i) => sum + i.amount, 0);

  const supabase = await createClient();
  // Supersede the current active plan.
  await supabase
    .from('payment_plans')
    .update({ status: 'stopped' })
    .eq('family_member_id', memberId)
    .eq('status', 'active');

  const { error } = await supabase.from('payment_plans').insert({
    family_member_id: memberId,
    plan_type: 'custom',
    total_amount: total,
    installment_schedule: schedule,
    status: 'active',
  });
  if (error) return { error: 'Could not create the custom plan.' };

  revalidateDancer(memberId);
  return { success: 'Custom plan created.' };
}

/** Send a password-reset email to a family's login. */
export async function sendPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Missing email.' };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: 'Could not send the reset email.' };
  return { success: `Password reset email sent to ${email}.` };
}
