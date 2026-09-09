import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { chargeStoredCard, isHelcimConfigured } from '@/lib/integrations/helcim';
import { sendAdminAlert } from '@/lib/integrations/adminAlert';
import { todayIso } from '@/lib/billing/dueDates';
import { money, formatDateShort } from '@/lib/format';

/**
 * Daily recurring-charge cron. Strictly opt-in: only plans with
 * `auto_charge = true` AND a `stored_card_token` (captured from a family's
 * first Pay Now checkout where they checked "save card") are touched.
 *
 * For each such plan, charges the first installment that's due (date <=
 * today) and not yet paid. The Helcim webhook remains the sole writer of
 * `payments` — this route only initiates the charge and records a
 * payment_intents row so the webhook can match the resulting transaction.
 *
 * Failed-charge policy: retry once, the next day this cron runs (a failed
 * payment_intents row doesn't block re-attempting the same installment, so
 * this falls out of the daily schedule naturally). Every failure sends an
 * immediate admin alert. If the retry also fails, auto-charge is switched
 * off for that plan (so the family isn't billed daily against a bad card)
 * and the alert says so — Debbie follows up with the family directly from
 * there rather than the system retrying indefinitely.
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
    .select('id, family_member_id, installment_schedule, stored_card_token, stored_customer_code')
    .eq('status', 'active')
    .eq('auto_charge', true)
    .not('stored_card_token', 'is', null);

  const results: { planId: string; outcome: string }[] = [];

  for (const plan of plans ?? []) {
    const schedule: { date: string; amount: number }[] = Array.isArray(plan.installment_schedule)
      ? (plan.installment_schedule as any)
      : [];

    const { data: paidPayments } = await admin
      .from('payments')
      .select('amount')
      .eq('payment_plan_id', plan.id)
      .not('paid_at', 'is', null);
    const paidTotal = (paidPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

    // Find the first due-but-unpaid installment by cumulative amount.
    let cumulative = 0;
    let targetIndex = -1;
    let targetAmount = 0;
    for (let i = 0; i < schedule.length; i++) {
      cumulative += Number(schedule[i]?.amount ?? 0);
      if (schedule[i]?.date <= today && paidTotal < cumulative - 0.005) {
        targetIndex = i;
        targetAmount = Number(schedule[i].amount);
        break;
      }
    }
    if (targetIndex === -1) {
      results.push({ planId: plan.id, outcome: 'nothing due' });
      continue;
    }

    // Skip if a charge for this installment is already in flight/completed.
    const { data: sameInstallmentIntents } = await admin
      .from('payment_intents')
      .select('id, status')
      .eq('payment_plan_id', plan.id)
      .eq('installment_index', targetIndex);
    const intents = sameInstallmentIntents ?? [];
    if (intents.some((i) => ['pending', 'client_confirmed', 'completed'].includes(i.status))) {
      results.push({ planId: plan.id, outcome: `installment ${targetIndex} already in progress` });
      continue;
    }

    const priorFailures = intents.filter((i) => i.status === 'failed').length;
    const attemptNumber = priorFailures + 1;

    // One retry only (the next day this cron runs). After a 2nd failure,
    // stop auto-charging this plan rather than hitting the card indefinitely.
    if (priorFailures >= 2) {
      results.push({ planId: plan.id, outcome: `installment ${targetIndex}: retries already exhausted` });
      continue;
    }

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

    try {
      const charge = await chargeStoredCard({
        amount: targetAmount,
        cardToken: plan.stored_card_token as string,
        reference,
      });
      results.push({
        planId: plan.id,
        outcome: charge.approved ? `charged ${reference}` : `declined ${reference}`,
      });
      // The webhook is still the source of truth for a successful `payments`
      // row; on decline we mark the intent failed directly rather than wait
      // for a webhook — Helcim may not send one for every decline reason.
      if (!charge.approved) {
        await handleFailedCharge(admin, intent?.id, plan.id, dancerName, targetAmount, schedule[targetIndex]?.date, attemptNumber, 'Card declined');
      }
    } catch (err) {
      results.push({ planId: plan.id, outcome: `charge failed: ${(err as Error).message}` });
      // No Helcim transaction was created at all here, so no webhook will
      // ever arrive for this intent — must resolve it ourselves or it stays
      // "pending" forever and permanently blocks retrying this installment.
      await handleFailedCharge(admin, intent?.id, plan.id, dancerName, targetAmount, schedule[targetIndex]?.date, attemptNumber, (err as Error).message);
    }
  }

  return NextResponse.json({ ok: true, checked: (plans ?? []).length, results });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function dancerNameFor(admin: AdminClient, familyMemberId: string): Promise<string> {
  const { data } = await admin
    .from('family_members')
    .select('first_name, last_name')
    .eq('id', familyMemberId)
    .maybeSingle();
  return data ? `${data.first_name} ${data.last_name}` : 'Unknown dancer';
}

async function handleFailedCharge(
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
        ? `This was the 2nd attempt, so automatic charging has been turned off for this dancer’s plan. Please follow up with the family directly (e.g. ask for a new card) — it will not retry again on its own.`
        : `This was attempt 1 of 2 — it will automatically retry tomorrow before giving up.`,
    ],
  );
}
