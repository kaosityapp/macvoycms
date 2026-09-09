import type { AdminClient } from './autoCharge';
import { sendPlainEmail } from '@/lib/integrations/adminAlert';
import { money, formatDateLong } from '@/lib/format';

/** Email the family a receipt — used by both the card webhook and the ACH settlement poller. */
export async function sendPaymentReceipt(
  admin: AdminClient,
  familyMemberId: string,
  amount: number,
  transactionId: string,
): Promise<void> {
  const { data: dancer } = await admin
    .from('family_members')
    .select('first_name, last_name, family:family_accounts(parent1_email)')
    .eq('id', familyMemberId)
    .maybeSingle();
  const parentEmail = (dancer as any)?.family?.parent1_email;
  if (!parentEmail) return;

  await sendPlainEmail(parentEmail, `Payment received — ${money(amount)} — MacVoy School of Irish Dance`, [
    `We received your payment of ${money(amount)} for ${dancer?.first_name} ${dancer?.last_name}, paid ${formatDateLong(new Date().toISOString().slice(0, 10))}.`,
    `Reference: ${transactionId}`,
    `You can see your full payment history anytime at https://www.macvoyirishdance.com/dashboard/payments`,
  ]);
}
