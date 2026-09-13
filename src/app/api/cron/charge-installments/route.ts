import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isHelcimConfigured,
  getAchTransaction,
  findCardTransactionByInvoice,
  findAchTransactionByInvoice,
  lookupCustomerIdByCode,
} from '@/lib/integrations/helcim';
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
  const cardReconciliation = await checkCardReconciliation(admin);

  return NextResponse.json({ ok: true, checked: (plans ?? []).length, results, achResults, cardReconciliation });
}

/**
 * Backstop for card payments: the webhook is normally the sole writer of
 * `payments`, but if it's ever missed (misconfigured secret, endpoint
 * briefly down, Helcim's retries exhausted before it recovers), a
 * successfully-charged card would otherwise sit stuck at 'pending' forever
 * — never recorded, no receipt, and blocked from ever being retried since
 * an in-flight intent blocks re-attempting that installment. This searches
 * Helcim directly by invoiceNumber (our reference) for any card intent
 * still unresolved after 30 minutes (long enough that a normal webhook
 * would already have arrived) and reconciles it. Anything found this way
 * also triggers an admin alert — it means the webhook itself needs
 * investigating, not just this one payment.
 *
 * A `bank_token IS NULL` intent isn't necessarily a card checkout, though —
 * it's also the state of a BANK (ACH) checkout whose client-side confirm
 * (confirmPaymentClientSide) never reached us, e.g. the family closed the
 * tab right after paying. That intent looks identical to an abandoned card
 * checkout (same status, no bank_token yet — that only gets set inside the
 * bank branch of confirmPaymentClientSide), so before concluding "never
 * completed" and expiring it, this also checks Helcim's ACH transactions —
 * otherwise a real, cleared bank withdrawal gets silently marked as if it
 * never happened.
 */
async function checkCardReconciliation(admin: AdminClient): Promise<{ id: string; outcome: string }[]> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const expireCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await admin
    .from('payment_intents')
    .select('id, family_member_id, payment_plan_id, installment_index, amount, category, reference, created_at, save_card')
    .in('status', ['pending', 'client_confirmed'])
    .is('bank_token', null) // not yet confirmed as either card or bank — see doc comment above
    .lte('created_at', cutoff);

  const out: { id: string; outcome: string }[] = [];
  for (const intent of stale ?? []) {
    let txn;
    try {
      txn = await findCardTransactionByInvoice(intent.reference);
    } catch (err) {
      out.push({ id: intent.id, outcome: `lookup failed: ${(err as Error).message}` });
      continue;
    }

    if (!txn) {
      const achOutcome = await reconcileAchFallback(admin, intent);
      if (achOutcome) {
        out.push({ id: intent.id, outcome: achOutcome });
        continue;
      }

      // Never reached Helcim at all (checkout abandoned) — stop checking
      // after 24h so it doesn't get polled forever.
      if (intent.created_at <= expireCutoff) {
        await admin.from('payment_intents').update({ status: 'expired' }).eq('id', intent.id);
        out.push({ id: intent.id, outcome: 'expired — never completed at Helcim' });
      } else {
        out.push({ id: intent.id, outcome: 'not found yet' });
      }
      continue;
    }

    const dancerName = await dancerNameFor(admin, intent.family_member_id);

    if (txn.status.toUpperCase() === 'APPROVED') {
      await admin
        .from('payments')
        .insert({
          family_member_id: intent.family_member_id,
          payment_plan_id: intent.payment_plan_id,
          amount: txn.amount || intent.amount,
          category: intent.category,
          paid_at: new Date().toISOString(),
          helcim_transaction_id: txn.transactionId,
        })
        .then(() => {}, () => {}); // idempotent — ignore unique-violation on a re-poll
      await admin
        .from('payment_intents')
        .update({ status: 'completed', helcim_transaction_id: txn.transactionId })
        .eq('id', intent.id);
      await sendPaymentReceipt(admin, intent.family_member_id, Number(txn.amount || intent.amount), txn.transactionId);
      await sendAdminAlert(`Missed webhook recovered — ${dancerName}`, [
        `${dancerName}'s payment of ${money(Number(txn.amount || intent.amount))} was actually approved at Helcim, but our webhook never recorded it — recovered by the daily reconciliation check instead.`,
        `Worth checking the Helcim webhook is still correctly configured (Deliver URL https://hooks.macvoyirishdance.com, event Card Transactions) if this keeps happening.`,
      ]);
      out.push({ id: intent.id, outcome: 'recovered — payment recorded, admin alerted' });
    } else {
      await admin
        .from('payment_intents')
        .update({ status: 'failed', helcim_transaction_id: txn.transactionId })
        .eq('id', intent.id);
      out.push({ id: intent.id, outcome: `recovered — declined (${txn.status})` });
    }
  }

  return out;
}

/**
 * Checked when a stale intent has no matching CARD transaction — is it
 * actually a bank (ACH) payment whose confirmPaymentClientSide call never
 * reached us? If Helcim shows it settled or declined, resolve it the same
 * way checkAchSettlements would have. Returns null (meaning "still genuinely
 * not found — fall through to the abandoned-checkout path") if there's no
 * matching ACH transaction either.
 */
async function reconcileAchFallback(
  admin: AdminClient,
  intent: {
    id: string;
    family_member_id: string;
    payment_plan_id: string | null;
    amount: number;
    category: string;
    reference: string;
    save_card: boolean;
  },
): Promise<string | null> {
  let achTxn;
  try {
    achTxn = await findAchTransactionByInvoice(intent.reference);
  } catch (err) {
    return `ach lookup failed: ${(err as Error).message}`;
  }
  if (!achTxn) return null;

  const dancerName = await dancerNameFor(admin, intent.family_member_id);
  const settledApproved = achTxn.statusAuth === 1 && achTxn.statusClearing === 1;
  const settledDeclined = achTxn.statusAuth === 2 || achTxn.statusAuth === 4 || achTxn.statusClearing === 4;

  if (settledApproved) {
    let bankCustomerId: string | null = null;
    if (achTxn.customerCode) {
      try {
        bankCustomerId = await lookupCustomerIdByCode(achTxn.customerCode);
      } catch {
        // Non-fatal — the payment itself still gets recorded below.
      }
    }

    await admin
      .from('payments')
      .insert({
        family_member_id: intent.family_member_id,
        payment_plan_id: intent.payment_plan_id,
        amount: achTxn.amount || intent.amount,
        category: intent.category,
        paid_at: new Date().toISOString(),
        method: 'ach',
        helcim_transaction_id: achTxn.id,
      })
      .then(() => {}, () => {}); // idempotent — ignore unique-violation on a re-poll
    await admin
      .from('payment_intents')
      .update({
        status: 'completed',
        helcim_transaction_id: achTxn.id,
        bank_account_id: achTxn.bankAccountId,
        bank_customer_code: achTxn.customerCode ?? null,
        bank_customer_id: bankCustomerId,
      })
      .eq('id', intent.id);

    if (intent.save_card && intent.payment_plan_id && achTxn.bankAccountId && bankCustomerId) {
      await admin
        .from('payment_plans')
        .update({
          stored_bank_customer_id: bankCustomerId,
          stored_bank_account_id: achTxn.bankAccountId,
          auto_charge: true,
        })
        .eq('id', intent.payment_plan_id);
    }

    await sendPaymentReceipt(admin, intent.family_member_id, Number(achTxn.amount || intent.amount), achTxn.id);
    await sendAdminAlert(`Missed bank payment confirmation recovered — ${dancerName}`, [
      `${dancerName}'s bank payment of ${money(Number(achTxn.amount || intent.amount))} settled successfully at Helcim, but we never recorded it — likely because they closed the page right after paying, before it could confirm here.`,
      `Recovered by the daily reconciliation check instead — no action needed, but worth knowing this happened.`,
    ]);
    return 'recovered — bank payment settled, payment recorded, admin alerted';
  }

  if (settledDeclined) {
    await admin.from('payment_intents').update({ status: 'failed', helcim_transaction_id: achTxn.id }).eq('id', intent.id);
    return `recovered — bank payment declined (statusAuth ${achTxn.statusAuth}, statusClearing ${achTxn.statusClearing})`;
  }

  // Exists at Helcim but still mid-settlement — hand it to the normal ACH
  // settlement poller instead of expiring it.
  await admin
    .from('payment_intents')
    .update({ status: 'settling', helcim_transaction_id: achTxn.id, bank_account_id: achTxn.bankAccountId })
    .eq('id', intent.id);
  return 'still settling at Helcim — handed off to settlement poll';
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
