'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  initializeCheckout,
  validateClientHash,
  isHelcimConfigured,
  lookupCustomerIdByCode,
  getAchTransaction,
} from '@/lib/integrations/helcim';
import { monthlySchedule, paidInFullSchedule } from '@/lib/billing/tuition';
import { defaultMonthlyDueDates, todayIso } from '@/lib/billing/dueDates';
import type { Json } from '@/lib/types/database';

export interface StartPaymentResult {
  error?: string;
  checkoutToken?: string;
  reference?: string;
}

/** Create a Helcim checkout session for one installment ("Pay Now"). */
export async function startPayment(input: {
  memberId: string;
  paymentPlanId: string;
  installmentIndex: number;
  amount: number;
  saveCard: boolean;
}): Promise<StartPaymentResult> {
  if (!isHelcimConfigured()) return { error: 'Online payment is not available yet.' };
  if (!(input.amount > 0)) return { error: 'Invalid amount.' };

  const supabase = await createClient();

  // owns_family_member() (via RLS) confirms this is the caller's own dancer.
  const { data: family } = await supabase
    .from('family_members')
    .select('family_account_id, family_accounts(parent1_name, parent1_email)')
    .eq('id', input.memberId)
    .maybeSingle();
  if (!family) return { error: 'Dancer not found.' };

  const reference = `MV-${randomBytes(5).toString('hex')}`;

  let session;
  try {
    session = await initializeCheckout({
      amount: input.amount,
      reference,
      description: 'MacVoy Tuition Payment',
      customerName: (family as any).family_accounts?.parent1_name,
      customerEmail: (family as any).family_accounts?.parent1_email,
      saveCard: input.saveCard,
    });
  } catch (err) {
    console.error('Helcim initializeCheckout failed:', err);
    return { error: 'Could not start the payment. Please try again.' };
  }

  const { error } = await supabase.from('payment_intents').insert({
    family_member_id: input.memberId,
    payment_plan_id: input.paymentPlanId,
    installment_index: input.installmentIndex,
    category: 'tuition',
    amount: input.amount,
    reference,
    checkout_token: session.checkoutToken,
    secret_token: session.secretToken,
    save_card: input.saveCard,
    status: 'pending',
  });
  if (error) return { error: 'Could not record the payment attempt.' };

  return { checkoutToken: session.checkoutToken, reference };
}

export interface ConfirmResult {
  ok: boolean;
  error?: string;
  /** True if we couldn't fast-verify but Helcim reported SUCCESS — the
   *  webhook will still record the real payment shortly. */
  pending?: boolean;
  /** True for a bank (ACH/EFT) payment — settlement is asynchronous (can
   *  take days) and confirmed by the daily cron's poll, not a webhook. */
  settling?: boolean;
}

/**
 * Fast-path client-side confirmation. Two very different payment types
 * land here, distinguished by the shape of `eventMessageJson`:
 *
 * Card: the webhook (HMAC-verified, see /api/webhooks/helcim) is the sole
 * AUTHORITATIVE writer of `payments` — this only marks payment_intents for
 * faster UI feedback. A hash mismatch here (e.g. JSON re-serialization
 * differences) must never contradict the fact that Helcim already told the
 * browser SUCCESS, so it's treated as "pending webhook", not an error.
 *
 * Bank (ACH/EFT): there is no webhook (confirmed with Helcim) — this IS the
 * only place bank details are ever captured. On a verified callback we
 * resolve Helcim's numeric customerId (from customerCode) and bankAccountId
 * (from the ACH transaction lookup) and store them; if the family checked
 * "save for automatic payments" those same IDs go on the payment_plan right
 * away. Settlement itself (did the withdrawal actually clear) is unknown
 * until the daily cron polls it — see checkAchSettlements in
 * src/app/api/cron/charge-installments/route.ts.
 */
export async function confirmPaymentClientSide(
  reference: string,
  eventMessageJson: string,
): Promise<ConfirmResult> {
  const supabase = await createClient();
  // Ownership check: this SELECT is RLS-scoped ("own intents read" —
  // owns_family_member() or is_admin()), so a non-owner gets null here and
  // the function bails before any write. The writes below then use the
  // admin client deliberately — payment_intents/payment_plans have no
  // owner UPDATE policy (only owner INSERT / admin ALL), so the
  // RLS-scoped client would silently no-op every update in this function
  // (0 rows affected, no error) despite ownership already being proven by
  // this read. That silent-no-op previously meant a bank payment could be
  // withdrawn via Helcim but never recorded as settling/paid, and "turn off
  // auto-charge" could appear to work in the UI while doing nothing in the DB.
  const { data: intent } = await supabase
    .from('payment_intents')
    .select('id, secret_token, status, payment_plan_id, save_card')
    .eq('reference', reference)
    .maybeSingle();
  if (!intent) return { ok: false, error: 'Unknown payment.' };
  const admin = createAdminClient();

  let parsed: { data: any; hash: string } | null = null;
  let verified = false;
  try {
    parsed = JSON.parse(eventMessageJson);
    verified = !!intent.secret_token && !!parsed && validateClientHash(parsed.data, parsed.hash, intent.secret_token);
  } catch {
    verified = false;
  }

  const isBankPayment = Boolean(parsed?.data?.bankToken || parsed?.data?.type === 'WITHDRAWAL');

  if (!verified) {
    revalidatePath('/dashboard/payments');
    return { ok: true, pending: true };
  }

  if (isBankPayment) {
    if (intent.status === 'pending' || intent.status === 'client_confirmed') {
      const d = parsed!.data;
      const transactionId = String(d.transactionId ?? '');
      const customerCode = d.customerCode ? String(d.customerCode) : null;
      const bankToken = d.bankToken ? String(d.bankToken) : null;

      let bankAccountId: string | null = null;
      let bankCustomerId: string | null = null;
      try {
        if (transactionId) {
          const txn = await getAchTransaction(transactionId);
          bankAccountId = txn.bankAccountId;
        }
        if (customerCode) {
          bankCustomerId = await lookupCustomerIdByCode(customerCode);
        }
      } catch (err) {
        console.error('Resolving ACH customer/bank IDs failed:', err);
      }

      await admin
        .from('payment_intents')
        .update({
          status: 'settling',
          helcim_transaction_id: transactionId || null,
          bank_token: bankToken,
          bank_customer_code: customerCode,
          bank_account_id: bankAccountId,
          bank_customer_id: bankCustomerId,
        })
        .eq('id', intent.id);

      // "Save for automatic payments" — store recurring capability now; it
      // doesn't depend on whether THIS specific withdrawal ends up settling.
      if (intent.save_card && intent.payment_plan_id && bankAccountId && bankCustomerId) {
        await admin
          .from('payment_plans')
          .update({
            stored_bank_customer_id: bankCustomerId,
            stored_bank_account_id: bankAccountId,
            auto_charge: true,
          })
          .eq('id', intent.payment_plan_id);
      }
    }
    revalidatePath('/dashboard/payments');
    return { ok: true, settling: true };
  }

  if (intent.status === 'pending') {
    await admin.from('payment_intents').update({ status: 'client_confirmed' }).eq('id', intent.id);
  }

  revalidatePath('/dashboard/payments');
  return { ok: true };
}

/** Parent opts a plan in/out of automatic recurring charges (their own dancer only). */
export async function setAutoCharge(planId: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  // Ownership check via the RLS-scoped client ("own plans read" policy) —
  // returns null for a plan that isn't the caller's own. The actual update
  // then uses the admin client: payment_plans only has an admin ALL policy,
  // no owner UPDATE policy, so the RLS-scoped client would silently update
  // 0 rows here — the "Turn off" button would appear to work while
  // auto_charge stayed true in the database and the family kept getting
  // charged.
  const { data: plan } = await supabase.from('payment_plans').select('id').eq('id', planId).maybeSingle();
  if (!plan) return;

  const admin = createAdminClient();
  await admin.from('payment_plans').update({ auto_charge: enabled }).eq('id', planId);
  revalidatePath('/dashboard/payments');
}

export interface ChoosePlanResult {
  error?: string;
}

/**
 * The family's own choice of monthly payments vs paid-in-full for the Fall
 * session, for a plan Debbie approved with just a total price (plan_type
 * 'awaiting_choice', empty schedule). Computes the actual installment
 * schedule and turns the plan into a normal 'monthly'/'paid_in_full' one.
 */
export async function chooseFamilyPlan(
  _prev: ChoosePlanResult,
  formData: FormData,
): Promise<ChoosePlanResult> {
  const planId = String(formData.get('plan_id') ?? '');
  const choice = String(formData.get('choice') ?? '');
  if (choice !== 'monthly' && choice !== 'paid_in_full') return { error: 'Choose a plan.' };

  const supabase = await createClient();
  // Ownership check (RLS "own plans read") before the admin-client write —
  // same reasoning as setAutoCharge above.
  const { data: plan } = await supabase
    .from('payment_plans')
    .select('id, plan_type, total_amount, family_member_id')
    .eq('id', planId)
    .maybeSingle();
  if (!plan) return { error: 'Plan not found.' };
  if (plan.plan_type !== 'awaiting_choice') return { error: 'This plan has already been set up.' };

  // Monthly payments are only offered at 2+ weekly classes — re-checked here
  // since a client can't be trusted to enforce this itself.
  if (choice === 'monthly') {
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('family_member_id', plan.family_member_id)
      .eq('status', 'active');
    if ((count ?? 0) < 2) {
      return { error: 'Monthly payments are only available with 2 or more weekly classes — please pay in full.' };
    }
  }

  const total = Number(plan.total_amount);
  const today = todayIso();
  const schedule =
    choice === 'monthly'
      ? monthlySchedule(total, defaultMonthlyDueDates(today))
      : paidInFullSchedule(total, today);

  const admin = createAdminClient();
  const { error } = await admin
    .from('payment_plans')
    .update({ plan_type: choice, installment_schedule: schedule as unknown as Json })
    .eq('id', planId);
  if (error) return { error: 'Could not save your choice. Please try again.' };

  revalidatePath('/dashboard/payments');
  return {};
}
