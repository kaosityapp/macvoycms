'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { POLICIES } from '@/lib/consents/policies';
import { getAddon } from '@/lib/constants/addons';
import type { Json } from '@/lib/types/database';

export interface CompleteRegistrationState {
  error?: string;
}

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.');

interface DancerPrefill {
  first_name: string;
  last_name: string;
  birthday?: string;
  gender?: string;
  address?: string;
  medical_notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  class_ids?: string[];
  addon?: string;
  plan_type?: string;
  total_amount: number;
  installment_schedule: { date: string; amount: number }[];
}

function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function completePendingRegistration(
  _prev: CompleteRegistrationState,
  formData: FormData,
): Promise<CompleteRegistrationState> {
  const user = await requireUser();
  const supabase = await createClient();
  const admin = createAdminClient();

  const password = passwordSchema.safeParse(s(formData, 'password'));
  if (!password.success) return { error: password.error.errors[0].message };
  if (s(formData, 'password') !== s(formData, 'confirmPassword')) {
    return { error: 'Passwords do not match.' };
  }

  for (const policy of POLICIES) {
    if (s(formData, `consent_${policy.type}`) !== 'on') {
      return { error: `You must agree to the ${policy.title} to register.` };
    }
  }

  // Re-fetch server-side — never trust the client for what gets created.
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .ilike('email', user.email ?? '')
    .eq('status', 'pending')
    .maybeSingle();
  if (!pending) {
    return { error: 'This pre-filled registration is no longer available. Please contact us.' };
  }

  const { error: pwError } = await supabase.auth.updateUser({ password: password.data });
  if (pwError) return { error: 'Could not set your password. Please try again.' };

  // family_account: attach if one already exists for this login, else create.
  const { data: existingAccount } = await admin
    .from('family_accounts')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  let familyAccountId: string;
  if (existingAccount) {
    familyAccountId = existingAccount.id;
  } else {
    const { data: fa, error: faError } = await admin
      .from('family_accounts')
      .insert({
        auth_user_id: user.id,
        parent1_name: pending.parent1_name || 'Parent',
        parent1_phone: pending.parent1_phone,
        parent1_email: user.email!,
        parent2_name: pending.parent2_name,
        parent2_phone: pending.parent2_phone,
        parent2_email: pending.parent2_email,
        referral_source: pending.referral_source,
      })
      .select('id')
      .single();
    if (faError || !fa) return { error: 'Could not create your family account.' };
    familyAccountId = fa.id;
  }

  const dancers = (pending.dancers ?? []) as unknown as DancerPrefill[];
  if (dancers.length === 0) {
    return { error: 'No dancer information found on this registration. Please contact us.' };
  }

  for (const d of dancers) {
    const { data: member, error: memberError } = await admin
      .from('family_members')
      .insert({
        family_account_id: familyAccountId,
        first_name: d.first_name,
        last_name: d.last_name,
        birthday: d.birthday || null,
        gender: d.gender || null,
        address: d.address || null,
        medical_notes: d.medical_notes || null,
        emergency_contact_name: d.emergency_contact_name || null,
        emergency_contact_phone: d.emergency_contact_phone || null,
        emergency_contact_relationship: d.emergency_contact_relationship || null,
      })
      .select('id')
      .single();
    if (memberError || !member) return { error: `Could not save ${d.first_name}'s details.` };
    const memberId = member.id;

    const { error: consentError } = await admin.from('consents').insert(
      POLICIES.map((policy) => ({
        family_member_id: memberId,
        type: policy.type,
        policy_text_snapshot: policy.text,
      })),
    );
    if (consentError) return { error: 'Could not record consents.' };

    if (d.class_ids?.length) {
      const { error: enrollError } = await admin
        .from('enrollments')
        .insert(d.class_ids.map((classId) => ({ family_member_id: memberId, class_id: classId })));
      if (enrollError) return { error: `Could not enroll ${d.first_name} in the selected classes.` };
    }

    const { error: planError } = await admin.from('payment_plans').insert({
      family_member_id: memberId,
      plan_type: d.plan_type || 'custom',
      total_amount: d.total_amount,
      installment_schedule: (d.installment_schedule ?? []) as unknown as Json,
      status: 'active',
    });
    if (planError) return { error: `Could not create ${d.first_name}'s payment plan.` };

    const addon = d.addon ? getAddon(d.addon) : undefined;
    if (addon?.itemType) {
      await admin.from('order_items').insert({
        family_member_id: memberId,
        item_type: addon.itemType,
        amount: addon.amount,
      });
    }
  }

  await admin
    .from('pending_registrations')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', pending.id);

  redirect('/dashboard?registered=1');
}
