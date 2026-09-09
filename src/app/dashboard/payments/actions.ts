'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  initializeCheckout,
  validateClientHash,
  isHelcimConfigured,
  lookupCustomerIdByCode,
  getAchTransaction,
} from '@/lib/integrations/helcim';

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
  const { data: intent } = await supabase
    .from('payment_intents')
    .select('id, secret_token, status, payment_plan_id, save_card')
    .eq('reference', reference)
    .maybeSingle();
  if (!intent) return { ok: false, error: 'Unknown payment.' };

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

      await supabase
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
        await supabase
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
    await supabase.from('payment_intents').update({ status: 'client_confirmed' }).eq('id', intent.id);
  }

  revalidatePath('/dashboard/payments');
  return { ok: true };
}

/** Parent opts a plan in/out of automatic recurring charges (their own dancer only). */
export async function setAutoCharge(planId: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from('payment_plans').update({ auto_charge: enabled }).eq('id', planId);
  revalidatePath('/dashboard/payments');
}
