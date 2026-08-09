import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { chargeStoredCard, isHelcimConfigured } from '@/lib/integrations/helcim';
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
    const { data: existingIntent } = await admin
      .from('payment_intents')
      .select('id, status')
      .eq('payment_plan_id', plan.id)
      .eq('installment_index', targetIndex)
      .in('status', ['pending', 'client_confirmed', 'completed'])
      .maybeSingle();
    if (existingIntent) {
      results.push({ planId: plan.id, outcome: `installment ${targetIndex} already ${existingIntent.status}` });
      continue;
    }

    const reference = `MV-AUTO-${randomBytes(5).toString('hex')}`;
    await admin.from('payment_intents').insert({
      family_member_id: plan.family_member_id,
      payment_plan_id: plan.id,
      installment_index: targetIndex,
      category: 'tuition',
      amount: targetAmount,
      reference,
      status: 'pending',
    });

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
      // The webhook records the actual `payments` row once Helcim confirms.
    } catch (err) {
      results.push({ planId: plan.id, outcome: `charge failed: ${(err as Error).message}` });
    }
  }

  return NextResponse.json({ ok: true, checked: (plans ?? []).length, results });
}
