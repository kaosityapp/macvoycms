'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  initializeCheckout,
  validateClientHash,
  isHelcimConfigured,
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
}

/**
 * Fast-path client-side confirmation. The webhook (HMAC-verified, see
 * /api/webhooks/helcim) is the sole AUTHORITATIVE writer of `payments` — this
 * only marks payment_intents for faster UI feedback. Because a hash mismatch
 * here (e.g. from JSON re-serialization differences between Helcim's original
 * bytes and a JS reparse+restringify) must never contradict the fact that
 * Helcim already told the browser SUCCESS, a failed/unparseable hash check is
 * treated as "pending webhook", not an error — the caller should never be
 * told a real, already-approved charge "failed".
 */
export async function confirmPaymentClientSide(
  reference: string,
  eventMessageJson: string,
): Promise<ConfirmResult> {
  const supabase = await createClient();
  const { data: intent } = await supabase
    .from('payment_intents')
    .select('id, secret_token, status')
    .eq('reference', reference)
    .maybeSingle();
  if (!intent) return { ok: false, error: 'Unknown payment.' };

  let verified = false;
  try {
    const parsed: { data: unknown; hash: string } = JSON.parse(eventMessageJson);
    verified =
      !!intent.secret_token && validateClientHash(parsed.data, parsed.hash, intent.secret_token);
  } catch {
    verified = false;
  }

  if (verified && intent.status === 'pending') {
    await supabase.from('payment_intents').update({ status: 'client_confirmed' }).eq('id', intent.id);
  }

  revalidatePath('/dashboard/payments');
  return { ok: true, pending: !verified };
}

/** Parent opts a plan in/out of automatic recurring charges (their own dancer only). */
export async function setAutoCharge(planId: string, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from('payment_plans').update({ auto_charge: enabled }).eq('id', planId);
  revalidatePath('/dashboard/payments');
}
