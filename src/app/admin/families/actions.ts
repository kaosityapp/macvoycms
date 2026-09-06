'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recalcDefaultPlanForMember } from '@/lib/admin/billing';

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
 * refund (spec §3.3). Requires an explicit typed confirmation. There is no
 * server-side "subscription" object to cancel with Helcim — recurring charges
 * are our own cron against a stored card token (see payment_plans.auto_charge)
 * — so stopping just disables that flag and marks the plan stopped.
 */
export async function stopBilling(formData: FormData): Promise<void> {
  const memberId = String(formData.get('member_id') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (!memberId || confirm !== 'STOP') return;

  const supabase = await createClient();
  await supabase
    .from('payment_plans')
    .update({ status: 'stopped', auto_charge: false })
    .eq('family_member_id', memberId)
    .eq('status', 'active');

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

/** Remove Student: soft-disable — mark removed, drop enrollments, stop billing. */
export async function removeStudent(formData: FormData): Promise<void> {
  const memberId = String(formData.get('member_id') ?? '');
  if (!memberId) return;
  const supabase = await createClient();
  await supabase.from('family_members').update({ status: 'removed' }).eq('id', memberId);
  await supabase
    .from('enrollments')
    .update({ status: 'removed' })
    .eq('family_member_id', memberId)
    .neq('status', 'removed');
  await supabase
    .from('payment_plans')
    .update({ status: 'stopped' })
    .eq('family_member_id', memberId)
    .eq('status', 'active');
  revalidateDancer(memberId);
}

/** Reactivate a soft-removed dancer (does not restore old enrollments). */
export async function reactivateStudent(formData: FormData): Promise<void> {
  const memberId = String(formData.get('member_id') ?? '');
  if (!memberId) return;
  const supabase = await createClient();
  await supabase.from('family_members').update({ status: 'active' }).eq('id', memberId);
  revalidateDancer(memberId);
}

/**
 * Admin edit of a confirmed dancer's personal details + account holder info.
 * Unlike the parent-facing confirm screen, admin CAN edit everything here —
 * this is exactly the "contact the school" path parents are pointed to.
 */
export async function updateDancerDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get('member_id') ?? '');
  const familyId = String(formData.get('family_id') ?? '');
  if (!memberId) return { error: 'Missing dancer.' };

  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  if (!firstName || !lastName) return { error: 'First and last name are required.' };

  const supabase = await createClient();

  const { error: memberError } = await supabase
    .from('family_members')
    .update({
      first_name: firstName,
      last_name: lastName,
      birthday: String(formData.get('birthday') ?? '').trim() || null,
      gender: String(formData.get('gender') ?? '').trim() || null,
      address: String(formData.get('address') ?? '').trim() || null,
      medical_notes: String(formData.get('medical_notes') ?? '').trim() || null,
      emergency_contact_name: String(formData.get('emergency_name') ?? '').trim() || null,
      emergency_contact_phone: String(formData.get('emergency_phone') ?? '').trim() || null,
      emergency_contact_relationship: String(formData.get('emergency_relationship') ?? '').trim() || null,
    })
    .eq('id', memberId);
  if (memberError) return { error: 'Could not save dancer details.' };

  if (familyId) {
    const parent1Name = String(formData.get('parent1_name') ?? '').trim();
    if (parent1Name) {
      const { error: familyError } = await supabase
        .from('family_accounts')
        .update({
          parent1_name: parent1Name,
          parent1_phone: String(formData.get('parent1_phone') ?? '').trim() || null,
          parent2_name: String(formData.get('parent2_name') ?? '').trim() || null,
          parent2_phone: String(formData.get('parent2_phone') ?? '').trim() || null,
          parent2_email: String(formData.get('parent2_email') ?? '').trim() || null,
        })
        .eq('id', familyId);
      if (familyError) return { error: 'Could not save account holder details.' };
    }
  }

  revalidateDancer(memberId);
  return { success: 'Saved.' };
}

/** Delete: permanently remove the dancer and all their records (cascades). */
export async function deleteDancer(formData: FormData): Promise<void> {
  const memberId = String(formData.get('member_id') ?? '');
  if (!memberId) return;
  const supabase = await createClient();
  await supabase.from('family_members').delete().eq('id', memberId);
  revalidatePath('/admin/families');
  redirect('/admin/families');
}
