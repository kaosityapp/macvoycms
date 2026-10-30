import type { AdminClient, InstallmentSchedule } from './autoCharge';
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
 *
 * `installment` identifies what was paid. When that installment carries a
 * `covers` list (one charge for several dancers), the receipt names each
 * dancer and what their part was for, instead of only the plan's dancer.
 */
export async function sendPaymentReceipt(
  admin: AdminClient,
  familyMemberId: string,
  amount: number,
  transactionId: string,
  paidAt?: string,
  installment?: { planId: string | null; index: number | null },
): Promise<void> {
  const { data: dancer } = await admin
    .from('family_members')
    .select('first_name, last_name, family:family_accounts(parent1_email)')
    .eq('id', familyMemberId)
    .maybeSingle();
  const parentEmail = (dancer as any)?.family?.parent1_email;
  if (!parentEmail) return;

  const covers = await installmentCovers(admin, installment);
  const dancerNames = covers.length
    ? joinNames([...new Set(covers.map((c) => c.dancer))])
    : `${dancer?.first_name} ${dancer?.last_name}`;

  const lines = [
    `We received your payment of ${money(amount)} for ${dancerNames}, paid ${formatDateLong(paidAt ? toEasternDateIso(paidAt) : todayIso())}.`,
  ];
  if (covers.length) {
    const subtotal = covers.reduce((sum, c) => sum + Number(c.amount), 0);
    const feeNote =
      Math.abs(subtotal - amount) >= 0.01 ? ` (${money(subtotal)} before the card processing fee)` : '';
    lines.push(
      // sendPlainEmail wraps each line in a <p>, so break the list with <br>.
      `This one payment covers${feeNote}:<br>` +
        covers.map((c) => `&bull; ${c.dancer} — ${c.item}: ${money(Number(c.amount))}`).join('<br>'),
    );
  }
  lines.push(
    `Reference: ${transactionId}`,
    `You can see your full payment history anytime at https://www.macvoyirishdance.com/dashboard/payments`,
  );

  await sendPlainEmail(parentEmail, `Payment received — ${money(amount)} — MacVoy School of Irish Dance`, lines);
}

async function installmentCovers(
  admin: AdminClient,
  installment?: { planId: string | null; index: number | null },
): Promise<NonNullable<InstallmentSchedule['covers']>> {
  if (!installment?.planId || installment.index == null) return [];
  const { data: plan } = await admin
    .from('payment_plans')
    .select('installment_schedule')
    .eq('id', installment.planId)
    .maybeSingle();
  const schedule = Array.isArray(plan?.installment_schedule)
    ? (plan.installment_schedule as unknown as InstallmentSchedule[])
    : [];
  return schedule[installment.index]?.covers ?? [];
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
