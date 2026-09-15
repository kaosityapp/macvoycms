import type { AdminClient } from './autoCharge';
import { todayIso, toEasternDateIso } from './dueDates';
import { sendPlainEmail } from '@/lib/integrations/adminAlert';
import { money, formatDateLong } from '@/lib/format';

/**
 * Email the family a receipt — used by both the card webhook and the ACH
 * settlement poller.
 *
 * `paidAt` is when the family actually paid. It matters for bank payments,
 * which settle days after the parent authorises them: dating the receipt
 * "today" tells someone who paid on Saturday that they paid on Tuesday.
 * Defaults to today for the card path, where the two are the same moment.
 */
export async function sendPaymentReceipt(
  admin: AdminClient,
  familyMemberId: string,
  amount: number,
  transactionId: string,
  paidAt?: string,
): Promise<void> {
  const { data: dancer } = await admin
    .from('family_members')
    .select('first_name, last_name, family:family_accounts(parent1_email)')
    .eq('id', familyMemberId)
    .maybeSingle();
  const parentEmail = (dancer as any)?.family?.parent1_email;
  if (!parentEmail) return;

  await sendPlainEmail(parentEmail, `Payment received — ${money(amount)} — MacVoy School of Irish Dance`, [
    `We received your payment of ${money(amount)} for ${dancer?.first_name} ${dancer?.last_name}, paid ${formatDateLong(paidAt ? toEasternDateIso(paidAt) : todayIso())}.`,
    `Reference: ${transactionId}`,
    `You can see your full payment history anytime at https://www.macvoyirishdance.com/dashboard/payments`,
  ]);
}
