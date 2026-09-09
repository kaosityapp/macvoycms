import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isHelcimConfigured } from '@/lib/integrations/helcim';
import { findDueInstallment, attemptInstallmentCharge, type InstallmentSchedule } from '@/lib/billing/autoCharge';
import { todayIso } from '@/lib/billing/dueDates';

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
 * there rather than the system retrying indefinitely. Admin can also force
 * an immediate retry, or push an installment's due date out a few days,
 * from that dancer's admin profile — see src/app/admin/families/actions.ts
 * (retryInstallmentNow / pushInstallmentDueDate).
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

    // Skip if a charge for this installment is already in flight/completed.
    const { data: sameInstallmentIntents } = await admin
      .from('payment_intents')
      .select('id, status')
      .eq('payment_plan_id', plan.id)
      .eq('installment_index', due.index);
    const intents = sameInstallmentIntents ?? [];
    if (intents.some((i) => ['pending', 'client_confirmed', 'completed'].includes(i.status))) {
      results.push({ planId: plan.id, outcome: `installment ${due.index} already in progress` });
      continue;
    }

    const priorFailures = intents.filter((i) => i.status === 'failed').length;
    const attemptNumber = priorFailures + 1;

    // One retry only (the next day this cron runs). After a 2nd failure,
    // stop auto-charging this plan rather than hitting the card indefinitely.
    // (Admin can still force another attempt from the dancer's admin profile.)
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
      outcome: 'error' in outcome ? outcome.error : outcome.approved ? `charged ${outcome.reference}` : `declined ${outcome.reference}`,
    });
  }

  return NextResponse.json({ ok: true, checked: (plans ?? []).length, results });
}
