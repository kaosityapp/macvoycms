'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { POLICIES } from '@/lib/consents/policies';
import { getAddon } from '@/lib/constants/addons';
import { sendAdminAlert, sendPlainEmail } from '@/lib/integrations/adminAlert';
import type { ReferralSource } from '@/lib/types/database';

export interface RegistrationState {
  error?: string;
}

export interface EmailCheckResult {
  error?: string;
  /** True if this email has a pre-filled registration waiting — a magic link
   *  was just sent and the caller should show "check your email". */
  matched?: boolean;
}

const emailSchema = z.string().email('Enter a valid email address.');

/**
 * Step 0 of registration: does this email have pre-filled dancer/class/
 * payment data from Debbie's import? If so, send a magic link (no password
 * exists yet for this login) and let /register/continue pick up from there.
 * If not, the caller falls through to the full registration form.
 */
export async function checkRegistrationEmail(
  _prev: EmailCheckResult,
  formData: FormData,
): Promise<EmailCheckResult> {
  const parsed = emailSchema.safeParse(String(formData.get('email') ?? '').trim());
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const email = parsed.data;

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from('pending_registrations')
    .select('id')
    .ilike('email', email)
    .eq('status', 'pending')
    .maybeSingle();

  if (!pending) return { matched: false };

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/register/continue` },
  });
  if (error) {
    console.error('signInWithOtp failed:', error);
    return { error: 'Could not send the verification email. Please try again.' };
  }

  return { matched: true };
}

const REFERRAL_VALUES: ReferralSource[] = [
  'internet_search',
  'social_media',
  'local_irish_club',
  'word_of_mouth',
  'returning_dancer',
  'restyling_transfer',
];

const memberSchema = z.object({
  firstName: z.string().min(1, 'Dancer first name is required.'),
  lastName: z.string().min(1, 'Dancer last name is required.'),
  address: z.string().min(1, 'Address is required.'),
  birthday: z.string().min(1, 'Birthday is required.'),
  gender: z.string().min(1, 'Gender is required.'),
  medicalNotes: z.string().min(1, 'Medical conditions/medications/allergies is required — enter "None" if not applicable.'),
  emergencyName: z.string().min(1, 'Emergency contact name is required.'),
  emergencyPhone: z.string().min(1, 'Emergency contact phone is required.'),
  emergencyRelationship: z.string().min(1, 'Emergency contact relationship is required.'),
});

const parentSchema = z.object({
  parent1Name: z.string().min(1, 'Parent name is required.'),
  parent1Phone: z.string().min(1, 'Parent 1 phone is required.'),
  parent1Email: z.string().email('Enter a valid parent email.'),
  parent2Name: z.string().min(1, 'Parent 2 name is required.'),
  parent2Phone: z.string().min(1, 'Parent 2 phone is required.'),
  parent2Email: z.string().email('Enter a valid parent 2 email.'),
  referralSource: z.string().min(1, 'Please tell us how you heard about us.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function registerDancer(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const supabase = await createClient();
  const admin = createAdminClient();

  // --- dancer fields -------------------------------------------------------
  const member = memberSchema.safeParse({
    firstName: s(formData, 'firstName'),
    lastName: s(formData, 'lastName'),
    address: s(formData, 'address'),
    birthday: s(formData, 'birthday'),
    gender: s(formData, 'gender'),
    medicalNotes: s(formData, 'medicalNotes'),
    emergencyName: s(formData, 'emergencyName'),
    emergencyPhone: s(formData, 'emergencyPhone'),
    emergencyRelationship: s(formData, 'emergencyRelationship'),
  });
  if (!member.success) return { error: member.error.errors[0].message };

  // --- classes -------------------------------------------------------------
  const classIds = formData.getAll('classIds').map(String).filter(Boolean);
  if (classIds.length === 0) return { error: 'Select at least one class.' };

  // --- consents (all required) ---------------------------------------------
  for (const policy of POLICIES) {
    if (s(formData, `consent_${policy.type}`) !== 'on') {
      return { error: `You must agree to the ${policy.title} to register.` };
    }
  }

  // Payment plan (quarterly vs paid-in-full) is chosen by the family AFTER
  // Debbie approves and sets a price — not here, since they don't know the
  // price yet. See dashboard/payments/ChoosePlanForm.tsx.

  // --- account: existing login, or create a new one ------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let familyAccountId: string;
  let parentEmail: string;

  if (user) {
    const { data: fa } = await admin
      .from('family_accounts')
      .select('id, parent1_email')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!fa) {
      return { error: 'No family account is linked to your login. Please contact us.' };
    }
    familyAccountId = fa.id;
    parentEmail = fa.parent1_email;
  } else {
    const parent = parentSchema.safeParse({
      parent1Name: s(formData, 'parent1Name'),
      parent1Phone: s(formData, 'parent1Phone'),
      parent1Email: s(formData, 'parent1Email'),
      parent2Name: s(formData, 'parent2Name'),
      parent2Phone: s(formData, 'parent2Phone'),
      parent2Email: s(formData, 'parent2Email'),
      referralSource: s(formData, 'referralSource'),
      password: s(formData, 'password'),
    });
    if (!parent.success) return { error: parent.error.errors[0].message };
    const p = parent.data;

    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email: p.parent1Email,
      password: p.password,
    });
    if (signUpError || !signUp.user) {
      const already = signUpError?.message.toLowerCase().includes('already');
      return {
        error: already
          ? 'An account with this email already exists — please log in first, then add your dancer.'
          : (signUpError?.message ?? 'Could not create your account.'),
      };
    }

    const referral =
      p.referralSource && REFERRAL_VALUES.includes(p.referralSource as ReferralSource)
        ? (p.referralSource as ReferralSource)
        : null;

    const { data: fa, error: faError } = await admin
      .from('family_accounts')
      .insert({
        auth_user_id: signUp.user.id,
        parent1_name: p.parent1Name,
        parent1_phone: p.parent1Phone || null,
        parent1_email: p.parent1Email,
        parent2_name: p.parent2Name || null,
        parent2_phone: p.parent2Phone || null,
        parent2_email: p.parent2Email || null,
        referral_source: referral,
      })
      .select('id')
      .single();
    if (faError || !fa) return { error: 'Could not create your family account.' };

    familyAccountId = fa.id;
    parentEmail = p.parent1Email;
  }

  const m = member.data;

  // --- family member -------------------------------------------------------
  const { data: newMember, error: memberError } = await admin
    .from('family_members')
    .insert({
      family_account_id: familyAccountId,
      first_name: m.firstName,
      last_name: m.lastName,
      address: m.address || null,
      birthday: m.birthday || null,
      gender: m.gender || null,
      medical_notes: m.medicalNotes || null,
      emergency_contact_name: m.emergencyName || null,
      emergency_contact_phone: m.emergencyPhone || null,
      emergency_contact_relationship: m.emergencyRelationship || null,
      // Not on Debbie's spreadsheet, so tuition isn't known yet — she sets
      // the price and approves before this dancer is billed for anything.
      status: 'pending_pricing',
    })
    .select('id')
    .single();
  if (memberError || !newMember) return { error: 'Could not save the dancer’s details.' };
  const memberId = newMember.id;

  // --- consents (snapshot the exact wording shown) -------------------------
  const { error: consentError } = await admin.from('consents').insert(
    POLICIES.map((policy) => ({
      family_member_id: memberId,
      type: policy.type,
      policy_text_snapshot: policy.text,
    })),
  );
  if (consentError) return { error: 'Could not record consents.' };

  // --- enrollments ---------------------------------------------------------
  const { error: enrollError } = await admin.from('enrollments').insert(
    classIds.map((classId) => ({ family_member_id: memberId, class_id: classId })),
  );
  if (enrollError) return { error: 'Could not enroll in the selected classes.' };

  // --- add-on (one-time charge) -------------------------------------------
  const addon = getAddon(s(formData, 'addon'));
  if (addon && addon.itemType) {
    await admin.from('order_items').insert({
      family_member_id: memberId,
      item_type: addon.itemType,
      amount: addon.amount,
    });
  }

  // No payment plan is created here — this dancer isn't on Debbie's
  // spreadsheet, so she needs to set the price before anything is billed.
  // She reviews it from the admin Dancers list ("Needs pricing"), sets a
  // plan, and that approval is what notifies the family to finalize payment.
  const { data: classNames } = await admin.from('classes').select('name').in('id', classIds);
  await sendAdminAlert(`New registration needs pricing — ${m.firstName} ${m.lastName}`, [
    `${m.firstName} ${m.lastName} just registered (not on the spreadsheet) and needs a price set before they can pay.`,
    `Parent: ${parentEmail}`,
    `Classes: ${(classNames ?? []).map((c) => c.name).join(', ') || 'none selected'}`,
    `Set their price from the admin Dancers list — approving it will email them to choose quarterly or paid-in-full and finalize payment.`,
  ]);

  await sendPlainEmail(parentEmail, `Registration received — ${m.firstName} ${m.lastName}`, [
    `Thanks — we've received ${m.firstName} ${m.lastName}'s registration and it's now waiting on approval.`,
    `Debbie will review it and set up the payment schedule shortly. You'll get another email as soon as it's approved so you can finalize payment.`,
    `If you don't hear back within 24 hours, please email macvoyirishdance@rogers.com.`,
  ]);

  redirect('/dashboard?registered=1');
}
