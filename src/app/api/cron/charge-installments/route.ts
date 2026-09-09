import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isHelcimConfigured, getAchTransaction } from '@/lib/integrations/helcim';
import {
  findDueInstallment,
  attemptInstallmentCharge,
  dancerNameFor,
  handleFailedCharge,
  type InstallmentSchedule,
  type AdminClient,
} from '@/lib/billing/autoCharge';
import { sendPaymentReceipt } from '@/lib/billing/receipts';
import { sendAdminAlert, sendPlainEmail } from '@/lib/integrations/adminAlert';
import { todayIso } from '@/lib/billing/dueDates';
import { money } from '@/lib/format';

/**
 * Daily recurring-charge cron. Strictly opt-in: only plans with
 * `auto_charge = true` AND a stored card OR bank account (captured from a
 * family's first Pay Now checkout where they checked "save for automatic
 * payments") are touched.
 *
 * For each such plan, charges the first installment that's due (date <=
 * today) and not yet paid. Card charges resolve same-day (approved/declined)
 * via the Payment API directly. Bank (ACH/EFT) withdrawals only *start*
 * here — Helcim confirms there is no webhook event for ACH, so this same
 * route also polls settlement status for any bank transaction still
 * "settling" (both from this cron and from a family's own Pay Now) — see
 * checkAchSettlements below.
 *
 * Failed-charge policy: retry once, the next day this cron runs (a failed
 * payment_intents row doesn't block re-attempting the same installment, so
 * this falls out of the daily schedule naturally). Every failure sends an
 * immediate admin alert. If the retry also fails, auto-charge is switched
 * off for that plan (so the family isn't billed daily against a bad card
 * or account) and the alert says so — Debbie follows up with the family
 * directly from there rather than the system retrying indefinitely. Admin
 * can also force an immediate retry, or push an installment's due date out
 * a few days, from that dancer's admin profile — see
 * src/app/admin/families/actions.ts (retryInstallmentNow / pushInstallmentDueDate).
 *
 * Configure in Vercel: Project → Settings → Cron Jobs, or via vercel.json,
 * pointing at this path with schedule "0 13 * * *" (adjust for your
 * timezone). Protect with CRON_SECRET — Vercel Cron sends it automatically
 * as a Bearer token when set as an env var of that name.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  if (!isHelcimConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'Helcim not configured' });
  }

  const admin = createAdminClient();
  const today = todayIso();

  const { data: plans } = await admin
    .from('payment_plans')
    .select(
      'id, family_member_id, installment_schedule, stored_card_token, stored_bank_customer_id, stored_bank_account_id',
    )
    .eq('status', 'active')
    .eq('auto_charge', true)
    .or('stored_card_token.not.is.null,stored_bank_account_id.not.is.null');

  const results: { planId: string; outcome: string }[] = [];

  for (const plan of plans ?? []) {
    const schedule: InstallmentSchedule[] = Array.isArray(plan.installment_schedule)
      ? (plan.installment_schedule as any)
      : [];

    const { data: paidPayments } = await admin
      .from('payments')
      .select('amount')
      .eq('payment_plan_id', plan.id)
      .not('paid_at', 'is', null);
    const paidTotal = (paidPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

    const due = findDueInstallment(schedule, paidTotal, today);
    if (!due) {
      results.push({ planId: plan.id, outcome: 'nothing due' });
      continue;
    }

    // Skip if a charge for this installment is already in flight/settling/completed.
    const { data: sameInstallmentIntents } = await admin
      .from('payment_intents')
      .select('id, status')
      .eq('payment_plan_id', plan.id)
      .eq('installment_index', due.index);
    const intents = sameInstallmentIntents ?? [];
    if (intents.some((i) => ['pending', 'client_confirmed', 'settling', 'completed'].includes(i.status))) {
      results.push({ planId: plan.id, outcome: `installment ${due.index} already in progress` });
      continue;
    }

    const priorFailures = intents.filter((i) => i.status === 'failed').length;
    const attemptNumber = priorFailures + 1;

    // One retry only (the next day this cron runs). After a 2nd failure,
    // stop auto-charging this plan rather than hitting the card/account
    // indefinitely. (Admin can still force another attempt from the
    // dancer's admin profile.)
    if (priorFailures >= 2) {
      results.push({ planId: plan.id, outcome: `installment ${due.index}: retries already exhausted` });
      continue;
    }

    const outcome = await attemptInstallmentCharge(
      admin,
      plan,
      due.index,
      due.amount,
      schedule[due.index]?.date,
      attemptNumber,
    );
    results.push({
      planId: plan.id,
      outcome:
        'error' in outcome
          ? outcome.error
          : outcome.settling
            ? `withdrawal started ${outcome.reference} (settlement pending)`
            : outcome.approved
              ? `charged ${outcome.reference}`
              : `declined ${outcome.reference}`,
    });
  }

  const achResults = await checkAchSettlements(admin);

  return NextResponse.json({ ok: true, checked: (plans ?? []).length, results, achResults });
}

/**
 * Poll every bank (ACH/EFT) transaction still awaiting settlement — both
 * ones this cron started and ones a family started themselves via Pay Now
 * (dashboard/payments/actions.ts confirmPaymentClientSide). There is no
 * webhook for ACH, so this poll is the only way any of these ever resolve.
 */
async function checkAchSettlements(admin: AdminClient): Promise<{ id: string; outcome: string }[]> {
  const { data: settling } = await admin
    .from('payment_intents')
    .select('id, family_member_id, payment_plan_id, installment_index, amount, category, reference, helcim_transaction_id')
    .eq('status', 'settling');

  const out: { id: string; outcome: string }[] = [];
  for (const intent of settling ?? []) {
    if (!intent.helcim_transaction_id) {
      out.push({ id: intent.id, outcome: 'no transaction id on file' });
      continue;
    }

    let txn;
    try {
      txn = await getAchTransaction(intent.helcim_transaction_id);
    } catch (err) {
      out.push({ id: intent.id, outcome: `lookup failed: ${(err as Error).message}` });
      continue;
    }

    const settledApproved = txn.statusAuth === 1 && txn.statusClearing === 1;
    const settledDeclined = txn.statusAuth === 2 || txn.statusAuth === 4 || txn.statusClearing === 4;

    if (settledApproved) {
      await admin
        .from('payments')
        .insert({
          family_member_id: intent.family_member_id,
          payment_plan_id: intent.payment_plan_id,
          amount: txn.amount || intent.amount,
          category: intent.category,
          paid_at: new Date().toISOString(),
          method: 'ach',
          helcim_transaction_id: txn.id,
        })
        .then(() => {}, () => {}); // idempotent — ignore unique-violation on a re-poll
      await admin.from('payment_intents').update({ status: 'completed' }).eq('id', intent.id);
      await sendPaymentReceipt(admin, intent.family_member_id, Number(txn.amount || intent.amount), txn.id);
      out.push({ id: intent.id, outcome: 'settled — payment recorded' });
      continue;
    }

    if (settledDeclined) {
      await admin.from('payment_intents').update({ status: 'failed' }).eq('id', intent.id);
      const dancerName = await dancerNameFor(admin, intent.family_member_id);

      if (intent.reference.startsWith('MV-AUTO-') && intent.payment_plan_id && intent.installment_index != null) {
        // Recurring auto-charge: same 2-strike policy as card.
        const { data: siblings } = await admin
          .from('payment_intents')
          .select('status')
          .eq('payment_plan_id', intent.payment_plan_id)
          .eq('installment_index', intent.installment_index);
        const attemptNumber = (siblings ?? []).filter((s) => s.status === 'failed').length;
        await handleFailedCharge(
          admin,
          undefined, // already marked failed above
          intent.payment_plan_id,
          dancerName,
          Number(intent.amount),
          undefined,
          attemptNumber,
          'Bank withdrawal declined',
        );
      } else {
        // A family's own manual Pay Now via bank payment — tell them directly.
        await sendAdminAlert(`Bank payment declined — ${dancerName}`, [
          `${dancerName}'s bank payment of ${money(Number(intent.amount))} did not settle (declined by their bank).`,
          `They've been emailed to try again.`,
        ]);
        const { data: dancer } = await admin
          .from('family_members')
          .select('family:family_accounts(parent1_email)')
          .eq('id', intent.family_member_id)
          .maybeSingle();
        const parentEmail = (dancer as any)?.family?.parent1_email;
        if (parentEmail) {
          await sendPlainEmail(parentEmail, `Your bank payment didn't go through — MacVoy School of Irish Dance`, [
            `Your recent payment of ${money(Number(intent.amount))} was declined by your bank and did not go through.`,
            `Please log in and try again, either with the same bank account or a credit card: https://www.macvoyirishdance.com/dashboard/payments`,
          ]);
        }
      }
      out.push({ id: intent.id, outcome: 'declined' });
      continue;
    }

    out.push({ id: intent.id, outcome: 'still settling' });
  }

  return out;
}
