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

  const parent1Name = s(formData, 'parent1Name');
  if (!parent1Name) return { error: 'Parent 1 name is required.' };

  for (const policy of POLICIES) {
    if (s(formData, `consent_${policy.type}`) !== 'on') {
      return { error: `You must agree to the ${policy.title} to register.` };
    }
  }

  // Re-fetch server-side — the dancer COUNT and payment plan come from here,
  // never from the client; only personal details/classes are editable.
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('*')
    .ilike('email', user.email ?? '')
    .eq('status', 'pending')
    .maybeSingle();
  if (!pending) {
    return { error: 'This pre-filled registration is no longer available. Please contact us.' };
  }

  const originalDancers = (pending.dancers ?? []) as unknown as DancerPrefill[];
  if (originalDancers.length === 0) {
    return { error: 'No dancer information found on this registration. Please contact us.' };
  }

  for (let i = 0; i < originalDancers.length; i++) {
    if (!s(formData, `firstName_${i}`) || !s(formData, `lastName_${i}`)) {
      return { error: `Dancer ${i + 1}: first and last name are required.` };
    }
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
    await admin
      .from('family_accounts')
      .update({
        parent1_name: parent1Name,
        parent1_phone: s(formData, 'parent1Phone') || null,
        parent2_name: s(formData, 'parent2Name') || null,
        parent2_phone: s(formData, 'parent2Phone') || null,
        parent2_email: s(formData, 'parent2Email') || null,
      })
      .eq('id', familyAccountId);
  } else {
    const { data: fa, error: faError } = await admin
      .from('family_accounts')
      .insert({
        auth_user_id: user.id,
        parent1_name: parent1Name,
        parent1_phone: s(formData, 'parent1Phone') || null,
        parent1_email: user.email!,
        parent2_name: s(formData, 'parent2Name') || null,
        parent2_phone: s(formData, 'parent2Phone') || null,
        parent2_email: s(formData, 'parent2Email') || null,
        referral_source: pending.referral_source,
      })
      .select('id')
      .single();
    if (faError || !fa) return { error: 'Could not create your family account.' };
    familyAccountId = fa.id;
  }

  for (let i = 0; i < originalDancers.length; i++) {
    const original = originalDancers[i];
    const classIds = formData.getAll(`classIds_${i}`).map(String).filter(Boolean);

    const { data: member, error: memberError } = await admin
      .from('family_members')
      .insert({
        family_account_id: familyAccountId,
        first_name: s(formData, `firstName_${i}`),
        last_name: s(formData, `lastName_${i}`),
        birthday: s(formData, `birthday_${i}`) || null,
        gender: s(formData, `gender_${i}`) || null,
        address: s(formData, `address_${i}`) || null,
        medical_notes: s(formData, `medicalNotes_${i}`) || null,
        emergency_contact_name: s(formData, `emergencyName_${i}`) || null,
        emergency_contact_phone: s(formData, `emergencyPhone_${i}`) || null,
        emergency_contact_relationship: s(formData, `emergencyRelationship_${i}`) || null,
      })
      .select('id')
      .single();
    if (memberError || !member) return { error: `Could not save dancer ${i + 1}'s details.` };
    const memberId = member.id;

    const { error: consentError } = await admin.from('consents').insert(
      POLICIES.map((policy) => ({
        family_member_id: memberId,
        type: policy.type,
        policy_text_snapshot: policy.text,
      })),
    );
    if (consentError) return { error: 'Could not record consents.' };

    if (classIds.length) {
      const { error: enrollError } = await admin
        .from('enrollments')
        .insert(classIds.map((classId) => ({ family_member_id: memberId, class_id: classId })));
      if (enrollError) return { error: `Could not enroll dancer ${i + 1} in the selected classes.` };
    }

    // Payment plan is never client-editable — always the school's figures.
    if (original.total_amount > 0) {
      const { error: planError } = await admin.from('payment_plans').insert({
        family_member_id: memberId,
        plan_type: original.plan_type || 'custom',
        total_amount: original.total_amount,
        installment_schedule: (original.installment_schedule ?? []) as unknown as Json,
        status: 'active',
      });
      if (planError) return { error: `Could not create dancer ${i + 1}'s payment plan.` };
    }

    const addon = original.addon ? getAddon(original.addon) : undefined;
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
