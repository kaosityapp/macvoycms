/**
 * Storing a family's bank account for future automatic withdrawals.
 *
 * Charging a saved bank account needs two things from Helcim: the numeric
 * bankAccountId, which comes straight off the ACH transaction, and the numeric
 * customerId, which does NOT — HelcimPay.js only hands back a customer *code*
 * (e.g. "CST1005"), so the id has to be looked up separately.
 *
 * That lookup is why five families who ticked "save for automatic payments"
 * ended up with nothing on file. It was attempted exactly once, in the same
 * breath as the checkout confirmation, and when it came back empty the save
 * was skipped — silently, because the failure is only a missing value, not an
 * error. The parent saw their payment succeed and never learned that the
 * standing authorisation they'd asked for hadn't been kept.
 *
 * So the attempt is made wherever a bank payment is handled, and the ACH
 * settlement poller retries it hours later — by which point the customer
 * certainly exists at Helcim, whatever was true at checkout. Resolving it once
 * is enough: the id is written back to the intent so a later pass can reuse it
 * rather than asking Helcim again.
 */

import { lookupCustomerIdByCode } from '@/lib/integrations/helcim';
import type { AdminClient } from './autoCharge';

export interface BankMandateInput {
  /** The intent this payment belongs to — its bank_customer_id is backfilled. */
  intentId: string;
  planId: string | null;
  /** The family's "save for automatic payments" choice. Nothing is stored without it. */
  saveCard: boolean;
  bankAccountId: string | null;
  /** Already-resolved customer id, when a previous pass found it. */
  customerId?: string | null;
  /** Helcim's customer code, used to resolve the id when it isn't known yet. */
  customerCode?: string | null;
}

export type BankMandateOutcome =
  /** Stored — this plan can now be auto-charged from the bank account. */
  | 'saved'
  /** Not wanted or not applicable (no opt-in, no plan, no bank account). */
  | 'skipped'
  /** Wanted, but Helcim could not give us a customer id to charge against. */
  | 'unresolved';

/**
 * Store the bank account against the plan, resolving the customer id first if
 * it isn't already known. Safe to call repeatedly — a plan that already has a
 * mandate is left alone, so a re-poll doesn't switch auto-charge back on after
 * an admin has deliberately turned it off.
 */
export async function saveBankMandate(
  admin: AdminClient,
  input: BankMandateInput,
): Promise<BankMandateOutcome> {
  if (!input.saveCard || !input.planId || !input.bankAccountId) return 'skipped';

  // Already stored, so there is nothing to do — and nothing to re-arm either.
  // This matters because the settlement poller can see the same intent more
  // than once: without it, a re-poll would switch auto_charge back on after an
  // admin had deliberately turned it off. Only this exact account counts as
  // "already stored"; a family who has since paid from a different bank
  // account is telling us to use the new one.
  const { data: plan } = await admin
    .from('payment_plans')
    .select('stored_bank_account_id, stored_bank_customer_id')
    .eq('id', input.planId)
    .maybeSingle();
  if (plan?.stored_bank_account_id === input.bankAccountId && plan?.stored_bank_customer_id) {
    return 'skipped';
  }

  let customerId = input.customerId ?? null;
  if (!customerId && input.customerCode) {
    try {
      customerId = await lookupCustomerIdByCode(input.customerCode);
    } catch (err) {
      // Helcim being unreachable is not final: the settlement poller calls
      // this again on its next run, so a transient failure costs a day, not
      // the mandate.
      console.error('Resolving the Helcim customer id failed:', err);
      return 'unresolved';
    }
  }
  if (!customerId) return 'unresolved';

  // Keep it on the intent too, so a later pass doesn't repeat the lookup.
  if (customerId !== input.customerId) {
    await admin
      .from('payment_intents')
      .update({ bank_customer_id: customerId })
      .eq('id', input.intentId);
  }

  await admin
    .from('payment_plans')
    .update({
      stored_bank_customer_id: customerId,
      stored_bank_account_id: input.bankAccountId,
      auto_charge: true,
    })
    .eq('id', input.planId);

  return 'saved';
}
