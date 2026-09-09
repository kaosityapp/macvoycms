import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { chargeStoredCard, chargeStoredBankAccount } from '@/lib/integrations/helcim';
import { sendAdminAlert } from '@/lib/integrations/adminAlert';
import { money, formatDateShort } from '@/lib/format';

/**
 * Shared core of the daily auto-charge cron, also used by the admin
 * "Retry now" action — see src/app/api/cron/charge-installments/route.ts
 * for the failure/retry policy this implements. Works with either the
 * service-role client (cron) or the request-scoped admin client (admin
 * actions — RLS already grants admins full access to these tables).
 */

export type AdminClient = SupabaseClient<Database>;

export interface InstallmentSchedule {
  date: string;
  amount: number;
}

export interface RecurringPlan {
  id: string;
  family_member_id: string;
  stored_card_token: string | null;
  stored_bank_customer_id?: string | null;
  stored_bank_account_id?: string | null;
}

/** The first due-but-unpaid installment by cumulative amount, or null. */
export function findDueInstallment(
  schedule: InstallmentSchedule[],
  paidTotal: number,
  today: string,
): { index: number; amount: number } | null {
  let cumulative = 0;
  for (let i = 0; i < schedule.length; i++) {
    cumulative += Number(schedule[i]?.amount ?? 0);
    if (schedule[i]?.date <= today && paidTotal < cumulative - 0.005) {
      return { index: i, amount: Number(schedule[i].amount) };
    }
  }
  return null;
}

export async function dancerNameFor(admin: AdminClient, familyMemberId: string): Promise<string> {
  const { data } = await admin
    .from('family_members')
    .select('first_name, last_name')
    .eq('id', familyMemberId)
    .maybeSingle();
  return data ? `${data.first_name} ${data.last_name}` : 'Unknown dancer';
}

/**
 * Attempt a charge for one installment and record the outcome. Prefers a
 * saved card if both are somehow on file. `attemptNumber` drives the
 * 2-strikes-and-auto_charge-off policy; pass 1 to always allow (e.g. an
 * admin-forced retry starts a fresh count).
 *
 * Card: same-day approve/decline via chargeStoredCard — a thrown error or a
 * decline is a known-final outcome, handled here directly (never relies
 * solely on the webhook — a thrown error means no Helcim transaction, and
 * therefore no webhook, ever existed).
 *
 * Bank (ACH/EFT): chargeStoredBankAccount only *creates* the withdrawal —
 * Helcim confirms there's no webhook for ACH, so whether it actually
 * settled is unknown until the poller checks GET /ach/transactions/{id} on
 * a later cron run. A successful create is recorded as 'settling', not
 * approved/failed — see checkAchSettlements in the cron route.
 */
export async function attemptInstallmentCharge(
  admin: AdminClient,
  plan: RecurringPlan,
  targetIndex: number,
  targetAmount: number,
  dueDate: string | undefined,
  attemptNumber: number,
): Promise<{ approved: boolean; reference: string; settling?: boolean } | { error: string }> {
  const usingCard = Boolean(plan.stored_card_token);
  const usingBank = !usingCard && Boolean(plan.stored_bank_customer_id && plan.stored_bank_account_id);
  if (!usingCard && !usingBank) return { error: 'No card or bank account on file for this plan.' };

  const dancerName = await dancerNameFor(admin, plan.family_member_id);
  const reference = `MV-AUTO-${randomBytes(5).toString('hex')}`;
  const { data: intent } = await admin
    .from('payment_intents')
    .insert({
      family_member_id: plan.family_member_id,
      payment_plan_id: plan.id,
      installment_index: targetIndex,
      category: 'tuition',
      amount: targetAmount,
      reference,
      status: 'pending',
    })
    .select('id')
    .single();

  if (usingCard) {
    try {
      const charge = await chargeStoredCard({
        amount: targetAmount,
        cardToken: plan.stored_card_token!,
        reference,
      });
      if (!charge.approved) {
        await handleFailedCharge(admin, intent?.id, plan.id, dancerName, targetAmount, dueDate, attemptNumber, 'Card declined');
      }
      return { approved: charge.approved, reference };
    } catch (err) {
      await handleFailedCharge(admin, intent?.id, plan.id, dancerName, targetAmount, dueDate, attemptNumber, (err as Error).message);
      return { approved: false, reference };
    }
  }

  // Bank withdrawal.
  try {
    const withdrawal = await chargeStoredBankAccount({
      amount: targetAmount,
      bankAccountId: plan.stored_bank_account_id!,
      customerId: plan.stored_bank_customer_id!,
    });
    if (intent?.id) {
      await admin
        .from('payment_intents')
        .update({ status: 'settling', helcim_transaction_id: withdrawal.transactionId })
        .eq('id', intent.id);
    }
    return { approved: false, settling: true, reference };
  } catch (err) {
    // A thrown error here means the withdrawal was never created at all —
    // a genuine, immediate failure (unlike "settling", which just means
    // "created, outcome pending").
    await handleFailedCharge(admin, intent?.id, plan.id, dancerName, targetAmount, dueDate, attemptNumber, (err as Error).message);
    return { approved: false, reference };
  }
}

export async function handleFailedCharge(
  admin: AdminClient,
  intentId: string | undefined,
  planId: string,
  dancerName: string,
  amount: number,
  dueDate: string | undefined,
  attemptNumber: number,
  reason: string,
): Promise<void> {
  if (intentId) {
    await admin.from('payment_intents').update({ status: 'failed' }).eq('id', intentId);
  }

  const exhausted = attemptNumber >= 2;
  if (exhausted) {
    await admin.from('payment_plans').update({ auto_charge: false }).eq('id', planId);
  }

  const due = dueDate ? formatDateShort(dueDate) : 'unknown date';
  await sendAdminAlert(
    exhausted
      ? `Auto-charge failed twice — turned off for ${dancerName}`
      : `Auto-charge failed for ${dancerName} — will retry tomorrow`,
    [
      `${dancerName}'s automatic payment of ${money(amount)} (due ${due}) failed.`,
      `Reason: ${reason}.`,
      exhausted
        ? `This was the 2nd attempt, so automatic charging has been turned off for this dancer’s plan. Please follow up with the family directly (e.g. ask for a new card or bank account) — it will not retry again on its own.`
        : `This was attempt 1 of 2 — it will automatically retry tomorrow before giving up.`,
    ],
  );
}
