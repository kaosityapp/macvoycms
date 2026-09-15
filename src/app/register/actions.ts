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
import { sendMagicLink } from '@/lib/authLinks';
import { verifyRegistrationForm, checkParentNames } from '@/lib/formGuard';
import { findMatchingAddress } from '@/lib/emailIdentity';

export interface RegistrationState {
  error?: string;
}

export interface EmailCheckResult {
  error?: string;
  /** True if this email has a pre-filled registration waiting. Affects only
   *  the wording shown next — both paths now send a link and wait. */
  matched?: boolean;
  /** A verification link went out; the caller should show "check your email". */
  sent?: boolean;
  /** This address already reaches an existing account, so the link signs them
   *  in rather than starting a new registration. Changes the wording only. */
  existingAccount?: boolean;
  /** The address the link was actually sent to. Differs from what they typed
   *  when a Gmail dot/plus variant resolved to an account on file. */
  sentTo?: string;
}

const emailSchema = z.string().email('Enter a valid email address.');

/**
 * Step 0 of registration. Everyone verifies their email before they can reach
 * the form; only the destination differs.
 *
 *  - Pre-filled from Debbie's import → /register/continue, which already knew
 *    how to confirm their details and set a password. Matches either parent's
 *    email on the import, since whichever one confirms becomes the login.
 *  - Everyone else → /register, which now recognises a verified visitor with
 *    no family account yet and shows them the full form.
 *
 * Verifying first is what stops automated signups: previously a script could
 * POST the form and get a real family_accounts row with an address it didn't
 * control. Of the eighteen bot accounts created in September, sixteen never
 * confirmed their address at all, and the two that did were confirmed by the
 * recipient's corporate mail scanner rather than by the bot — which the POST-
 * only /auth/confirm page now prevents too.
 *
 * It also kills a long-standing support problem: a typo'd address used to
 * create an account nobody could log into or receive mail at.
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
    .or(`email.ilike.${email},parent2_email.ilike.${email}`)
    .eq('status', 'pending')
    .maybeSingle();

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';

  if (pending) {
    const result = await sendMagicLink(email, origin, {
      next: '/register/continue',
      subject: 'Finish your MacVoy registration',
      intro:
        'Click below to verify your email and finish registering your dancer with MacVoy School of Irish Dance.',
      cta: 'Finish my registration',
    });
    if (!result.ok) {
      return { error: 'Could not send the verification email. Please try again.' };
    }
    return { matched: true, sent: true, sentTo: email };
  }

  // No pre-filled registration. If some other address already reaching this
  // same mailbox has an account, send them to that one rather than starting a
  // second — this is what stops one operator turning a single Gmail inbox into
  // a dozen accounts via dotted variants.
  const { data: accounts } = await admin
    .from('family_accounts')
    .select('id, parent1_email');
  const duplicate = findMatchingAddress(
    email,
    (accounts ?? []).map((a) => ({ id: a.id, email: a.parent1_email })),
  );
  if (duplicate) {
    const result = await sendMagicLink(duplicate.email, origin, {
      next: '/register',
      subject: 'Your MacVoy account',
      intro:
        'You already have a MacVoy School of Irish Dance account with this email address. Click below to sign in and add another dancer.',
      cta: 'Sign in to my account',
    });
    if (!result.ok) {
      return { error: 'Could not send the verification email. Please try again.' };
    }
    return { matched: false, sent: true, existingAccount: true, sentTo: duplicate.email };
  }

  const result = await sendMagicLink(email, origin, {
    next: '/register',
    subject: 'Verify your email to register with MacVoy',
    intro:
      'Click below to verify your email address and continue registering your dancer with MacVoy School of Irish Dance.',
    cta: 'Continue my registration',
  });
  if (!result.ok) {
    return { error: 'Could not send the verification email. Please try again.' };
  }

  return { matched: false, sent: true, sentTo: email };
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
  city: z.string().min(1, 'City is required.'),
  province: z.string().min(1, 'Province is required.'),
  postalCode: z.string().min(1, 'Postal / zip code is required.'),
  phoneNumber: z.string().min(1, 'Phone number is required.'),
  phoneType: z.enum(['Mobile', 'Home'], { errorMap: () => ({ message: 'Select Mobile or Home.' }) }),
  birthday: z.string().min(1, 'Birthday is required.'),
  gender: z.string().min(1, 'Gender is required.'),
  medicalNotes: z.string().min(1, 'Medical conditions/medications/allergies is required — enter "None" if not applicable.'),
  emergencyName: z.string().min(1, 'Emergency contact name is required.'),
  emergencyPhone: z.string().min(1, 'Emergency contact phone is required.'),
  emergencyRelationship: z.string().min(1, 'Emergency contact relationship is required.'),
});

const parentSchema = z.object({
  // Required for a 'child' registrant; for 'adult' these are derived from the
  // dancer's own name/phone instead (see registerDancer) — no repeat entry.
  parent1Name: z.string().optional(),
  parent1Phone: z.string().optional(),
  parent1Email: z.string().email('Enter a valid parent email.'),
  parent2Name: z.string().optional(),
  parent2Phone: z.string().optional(),
  parent2Email: z.union([z.string().email(), z.literal('')]).optional(),
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

  // --- spam guard ----------------------------------------------------------
  // Runs before anything is written. Automated signups were creating ~40% of
  // all family accounts; see src/lib/formGuard.ts for the signature and why
  // this isn't a CAPTCHA.
  const guard = verifyRegistrationForm(formData);
  if (!guard.ok) {
    console.warn(`Registration rejected by spam guard: ${guard.logDetail}`);
    return { error: guard.reason };
  }

  // --- dancer fields -------------------------------------------------------
  const member = memberSchema.safeParse({
    firstName: s(formData, 'firstName'),
    lastName: s(formData, 'lastName'),
    address: s(formData, 'address'),
    city: s(formData, 'city'),
    province: s(formData, 'province'),
    postalCode: s(formData, 'postalCode'),
    phoneNumber: s(formData, 'phoneNumber'),
    phoneType: s(formData, 'phoneType'),
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

  // Payment plan (Fall Sessions schedule) is set by Debbie after she reviews
  // and prices this registration — not here, since neither of us knows the
  // price yet. See admin/families/[id]/CustomPlanForm.tsx.

  // --- account: existing login, or create a new one ------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let familyAccountId: string;
  let parentEmail: string;
  const dancerType = s(formData, 'registrantType') === 'adult' ? 'adult' : 'child';
  // This dancer's own guardian contact — separate from the account holder,
  // since an existing account can register dancers with different guardians.
  // 'adult' dancers have no guardian (they're their own contact).
  let guardian1Name: string | null = null;
  let guardian1Phone: string | null = null;
  let guardian1Email: string | null = null;
  let guardian2Name: string | null = null;
  let guardian2Phone: string | null = null;
  let guardian2Email: string | null = null;

  // Three cases: an established family adding a dancer; someone who has just
  // verified their email and is registering for the first time; and nobody,
  // which can only be a direct POST since the form is unreachable without a
  // verified session.
  const { data: existingAccount } = user
    ? await admin
        .from('family_accounts')
        .select('id, parent1_email')
        .or(`auth_user_id.eq.${user.id},parent2_auth_user_id.eq.${user.id}`)
        .maybeSingle()
    : { data: null };

  if (user && existingAccount) {
    familyAccountId = existingAccount.id;
    parentEmail = existingAccount.parent1_email;

    if (dancerType === 'child') {
      guardian1Name = s(formData, 'guardian1Name');
      guardian1Phone = s(formData, 'guardian1Phone');
      guardian1Email = s(formData, 'guardian1Email');
      if (!guardian1Name) return { error: 'Guardian 1 name is required.' };
      if (!guardian1Phone) return { error: 'Guardian 1 phone is required.' };
      if (!guardian1Email) return { error: 'Guardian 1 email is required.' };
      guardian2Name = s(formData, 'guardian2Name') || null;
      guardian2Phone = s(formData, 'guardian2Phone') || null;
      guardian2Email = s(formData, 'guardian2Email') || null;
    }
  } else {
    if (!user) {
      return {
        error:
          'Please verify your email before registering. Start again from the registration page and we will send you a link.',
      };
    }

    // The verification link signed them in, so the session's address is the
    // one they proved they own. Use it rather than the posted field, which is
    // read-only in the form but still attacker-controlled on the wire.
    const verifiedEmail = user.email;
    if (!verifiedEmail) {
      return { error: 'Your session is missing an email address. Please start again.' };
    }

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

    const nameCheck = checkParentNames([p.parent1Name, p.parent2Name]);
    if (nameCheck) {
      console.warn(`Registration rejected by spam guard: ${nameCheck.logDetail}`);
      return { error: nameCheck.reason };
    }

    // 'Adult' registrants are their own account holder — reuse the dancer's
    // own name/phone (collected once, in the Dancer section) instead of
    // asking for it twice.
    const parent1Name = dancerType === 'adult' ? `${member.data.firstName} ${member.data.lastName}` : (p.parent1Name ?? '').trim();
    const parent1Phone = dancerType === 'adult' ? member.data.phoneNumber : (p.parent1Phone ?? '').trim();
    if (!parent1Name) return { error: 'Parent 1 name is required.' };
    if (!parent1Phone) return { error: 'Parent 1 phone is required.' };

    // This first dancer's guardian is the account holder being created here
    // (no separate ask) — 'adult' dancers have no guardian.
    if (dancerType === 'child') {
      guardian1Name = parent1Name;
      guardian1Phone = parent1Phone;
      guardian1Email = verifiedEmail;
      guardian2Name = p.parent2Name || null;
      guardian2Phone = p.parent2Phone || null;
      guardian2Email = p.parent2Email || null;
    }

    // They already exist in auth — the verification link signed them in — so
    // this sets their password rather than creating a second account.
    const { error: pwError } = await supabase.auth.updateUser({ password: p.password });
    if (pwError) {
      return { error: 'Could not set your password. Please try again.' };
    }

    const referral =
      p.referralSource && REFERRAL_VALUES.includes(p.referralSource as ReferralSource)
        ? (p.referralSource as ReferralSource)
        : null;

    const { data: fa, error: faError } = await admin
      .from('family_accounts')
      .insert({
        auth_user_id: user.id,
        parent1_name: parent1Name,
        parent1_phone: parent1Phone || null,
        parent1_email: verifiedEmail,
        parent2_name: p.parent2Name || null,
        parent2_phone: p.parent2Phone || null,
        parent2_email: p.parent2Email || null,
        referral_source: referral,
      })
      .select('id')
      .single();
    if (faError || !fa) return { error: 'Could not create your family account.' };

    familyAccountId = fa.id;
    parentEmail = verifiedEmail;
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
      city: m.city || null,
      province: m.province || null,
      postal_code: m.postalCode || null,
      phone_number: m.phoneNumber || null,
      phone_type: m.phoneType || null,
      birthday: m.birthday || null,
      gender: m.gender || null,
      medical_notes: m.medicalNotes || null,
      emergency_contact_name: m.emergencyName || null,
      emergency_contact_phone: m.emergencyPhone || null,
      emergency_contact_relationship: m.emergencyRelationship || null,
      dancer_type: dancerType,
      guardian1_name: guardian1Name,
      guardian1_phone: guardian1Phone,
      guardian1_email: guardian1Email,
      guardian2_name: guardian2Name,
      guardian2_phone: guardian2Phone,
      guardian2_email: guardian2Email,
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
    `Set their Fall Sessions payment schedule from the admin Dancers list — creating it will email them to finalize payment.`,
  ]);

  await sendPlainEmail(parentEmail, `Registration received — ${m.firstName} ${m.lastName}`, [
    `Thanks — we've received ${m.firstName} ${m.lastName}'s registration and it's now waiting on approval.`,
    `Debbie will review it and set up the payment schedule shortly. You'll get another email as soon as it's approved so you can finalize payment.`,
    `If you don't hear back within 24 hours, please email macvoyirishdance@rogers.com.`,
  ]);

  redirect('/dashboard?registered=1');
}
