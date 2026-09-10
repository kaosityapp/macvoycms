'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth';
import { recalcDefaultPlanForMember } from '@/lib/admin/billing';
import { findDueInstallment, attemptInstallmentCharge } from '@/lib/billing/autoCharge';
import { todayIso, addDays } from '@/lib/billing/dueDates';
import { sendPlainEmail } from '@/lib/integrations/adminAlert';
import { money } from '@/lib/format';

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

  // If this dancer was awaiting pricing (registered directly, not from the
  // spreadsheet), setting their first plan IS the approval — activate them
  // and let the family know they can now finalize payment.
  const { data: dancer } = await supabase
    .from('family_members')
    .select('status, first_name, last_name, family:family_accounts(parent1_email)')
    .eq('id', memberId)
    .maybeSingle();
  let approved = false;
  if (dancer?.status === 'pending_pricing') {
    await supabase.from('family_members').update({ status: 'active' }).eq('id', memberId);
    const parentEmail = (dancer as any).family?.parent1_email;
    if (parentEmail) {
      await sendPlainEmail(
        parentEmail,
        `${dancer.first_name}'s registration is approved — MacVoy School of Irish Dance`,
        [
          `Good news — ${dancer.first_name} ${dancer.last_name}'s registration has been approved and priced.`,
          `Log in to your account to see the payment schedule and finalize payment: https://www.macvoyirishdance.com/dashboard/payments`,
        ],
      );
    }
    approved = true;
  }

  revalidateDancer(memberId);
  return { success: approved ? 'Plan created — dancer approved and family notified.' : 'Custom plan created.' };
}

const PAYMENT_METHODS = new Set(['cash', 'e-transfer', 'cheque', 'other']);

/** Record a payment Debbie received outside Helcim (cash, e-transfer, cheque). */
export async function recordManualPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get('member_id') ?? '');
  if (!memberId) return { error: 'Missing dancer.' };

  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid amount.' };

  const date = String(formData.get('date') ?? '').trim();
  if (!date) return { error: 'Enter the date received.' };

  const method = String(formData.get('method') ?? '');
  if (!PAYMENT_METHODS.has(method)) return { error: 'Choose a payment method.' };

  const note = String(formData.get('note') ?? '').trim() || null;

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('payment_plans')
    .select('id')
    .eq('family_member_id', memberId)
    .eq('status', 'active')
    .maybeSingle();

  const { error } = await supabase.from('payments').insert({
    family_member_id: memberId,
    payment_plan_id: plan?.id ?? null,
    amount,
    category: 'tuition',
    paid_at: new Date(date).toISOString(),
    method,
    note,
  });
  if (error) return { error: 'Could not record the payment.' };

  // Receipt parity with online payments — a manually-recorded e-transfer/
  // cash/cheque should look no different to the family than a card payment.
  const { data: dancer } = await supabase
    .from('family_members')
    .select('first_name, last_name, family:family_accounts(parent1_email)')
    .eq('id', memberId)
    .maybeSingle();
  const parentEmail = (dancer as any)?.family?.parent1_email;
  if (parentEmail) {
    await sendPlainEmail(parentEmail, `Payment received — ${money(amount)} — MacVoy School of Irish Dance`, [
      `We received your payment of ${money(amount)} for ${dancer?.first_name} ${dancer?.last_name}, paid ${date} via ${method}.`,
      ...(note ? [`Note: ${note}`] : []),
      `You can see your full payment history anytime at https://www.macvoyirishdance.com/dashboard/payments`,
    ]);
  }

  revalidateDancer(memberId);
  return { success: `${money(amount)} recorded${parentEmail ? ' and receipted' : ''}.` };
}

/**
 * Admin-forced immediate retry of the next due installment — for a family
 * that fixed their card, or just needs Debbie to try again right now rather
 * than waiting for tomorrow's automatic retry. Resets the 2-strikes count
 * (this is a fresh, deliberate attempt) and turns auto_charge back on if it
 * had been switched off after prior failures.
 */
export async function retryInstallmentNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Explicit check: this triggers a REAL Helcim charge (chargeStoredCard /
  // chargeStoredBankAccount) directly, not just a DB write — RLS on
  // payment_plans/payment_intents doesn't cover that external call. Without
  // this, a signed-in parent (or anyone who obtains this action's id from
  // this admin page's public JS bundle) could trigger a real charge attempt
  // outside the normal Pay Now consent/checkout flow.
  await requireAdmin();

  const memberId = String(formData.get('member_id') ?? '');
  const planId = String(formData.get('plan_id') ?? '');
  if (!memberId || !planId) return { error: 'Missing plan.' };

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('payment_plans')
    .select('id, family_member_id, installment_schedule, stored_card_token, stored_bank_customer_id, stored_bank_account_id')
    .eq('id', planId)
    .maybeSingle();
  if (!plan) return { error: 'Plan not found.' };
  if (!plan.stored_card_token && !(plan.stored_bank_customer_id && plan.stored_bank_account_id)) {
    return { error: 'No card or bank account on file for this dancer — ask the family to Pay Now and save one first.' };
  }

  const schedule = Array.isArray(plan.installment_schedule) ? (plan.installment_schedule as any) : [];
  const { data: paidPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('payment_plan_id', plan.id)
    .not('paid_at', 'is', null);
  const paidTotal = (paidPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  const due = findDueInstallment(schedule, paidTotal, todayIso());
  if (!due) return { error: 'Nothing is currently due on this plan.' };

  const { data: inFlight } = await supabase
    .from('payment_intents')
    .select('id, status')
    .eq('payment_plan_id', plan.id)
    .eq('installment_index', due.index)
    .in('status', ['pending', 'client_confirmed', 'settling', 'completed'])
    .maybeSingle();
  if (inFlight) return { error: `That installment is already ${inFlight.status}.` };

  await supabase.from('payment_plans').update({ auto_charge: true }).eq('id', plan.id);

  const outcome = await attemptInstallmentCharge(supabase, plan, due.index, due.amount, schedule[due.index]?.date, 1);

  revalidateDancer(memberId);
  if ('error' in outcome) return { error: outcome.error };
  if (outcome.settling) {
    return { success: `Bank withdrawal of ${money(due.amount)} started — settlement can take a few days; we'll email a receipt once confirmed.` };
  }
  return outcome.approved
    ? { success: `Charged ${money(due.amount)} — the receipt will appear once Helcim confirms it.` }
    : { error: `Declined. Debbie has been notified — try a different card/account or contact the family.` };
}

/** Push one installment's due date out a few days (a family needs a bit more time). */
export async function pushInstallmentDueDate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const memberId = String(formData.get('member_id') ?? '');
  const planId = String(formData.get('plan_id') ?? '');
  const installmentIndex = Number(formData.get('installment_index'));
  const days = Number(formData.get('days'));
  if (!memberId || !planId || !Number.isInteger(installmentIndex)) return { error: 'Missing installment.' };
  if (!Number.isFinite(days) || days <= 0) return { error: 'Choose how many days to push it out.' };

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from('payment_plans')
    .select('id, installment_schedule')
    .eq('id', planId)
    .maybeSingle();
  if (!plan) return { error: 'Plan not found.' };

  const schedule = Array.isArray(plan.installment_schedule) ? [...(plan.installment_schedule as any[])] : [];
  const installment = schedule[installmentIndex];
  if (!installment) return { error: 'Installment not found.' };

  const newDate = addDays(installment.date, days);
  schedule[installmentIndex] = { ...installment, date: newDate };

  const { error } = await supabase
    .from('payment_plans')
    .update({ installment_schedule: schedule })
    .eq('id', planId);
  if (error) return { error: 'Could not update the due date.' };

  revalidateDancer(memberId);
  return { success: `Pushed to ${newDate}.` };
}

/** Send a password-reset email to a family's login. */
export async function sendPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Explicit check: unlike a normal DB write, resetPasswordForEmail() is a
  // Supabase Auth API call — it isn't covered by any RLS policy, and it
  // takes an arbitrary email string, not a scoped record id. Without this,
  // anyone who can invoke this server action (its action id ships in this
  // admin page's public JS bundle regardless of who can render the page)
  // could repeatedly email-bomb any address with reset links.
  await requireAdmin();

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

export interface ImpersonateState {
  error?: string;
  url?: string;
}

/**
 * Generate a one-time login link for this dancer's family — lets Debbie see
 * exactly what they see on their dashboard. Uses Supabase's admin
 * generateLink API (a real magic link, not a fake preview) rather than the
 * limited schedule-only /view page. The link is returned directly to the
 * admin's own browser response — never logged or persisted — and is
 * single-use / time-limited by Supabase itself.
 */
export async function impersonateFamily(_prev: ImpersonateState, formData: FormData): Promise<ImpersonateState> {
  await requireAdmin();

  const memberId = String(formData.get('member_id') ?? '');
  if (!memberId) return { error: 'Missing dancer.' };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from('family_members')
    .select('family:family_accounts(parent1_email)')
    .eq('id', memberId)
    .maybeSingle();
  const email = (member as any)?.family?.parent1_email as string | undefined;
  if (!email) return { error: 'No login found for this family.' };

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: 'https://www.macvoyirishdance.com/auth/callback?next=/dashboard' },
  });
  if (error || !data?.properties?.action_link) return { error: 'Could not generate a login link.' };

  return { url: data.properties.action_link };
}
