import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature, getCardTransaction } from '@/lib/integrations/helcim';

/**
 * Helcim webhook — the single source of truth for recording a completed
 * payment. Register this URL in Helcim: All Tools → Integrations → Webhooks
 * → Deliver URL = https://<your-domain>/api/webhooks/helcim (cardTransaction
 * event). See src/lib/integrations/helcim.ts for the verification scheme.
 *
 * Flow: verify signature → the payload only carries {id, type} → fetch the
 * full transaction from Helcim → match it to our payment_intents row via the
 * invoiceNumber (our `reference`) → insert into `payments` (idempotent on
 * helcim_transaction_id) → optionally capture a stored card token if the
 * family opted in to automatic future charges.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const webhookId = request.headers.get('webhook-id') ?? '';
  const timestamp = request.headers.get('webhook-timestamp') ?? '';
  const signature = request.headers.get('webhook-signature') ?? '';

  let verified: boolean;
  try {
    verified = verifyWebhookSignature(rawBody, { id: webhookId, timestamp, signature });
  } catch {
    // HELCIM_WEBHOOK_SECRET not configured yet.
    return new NextResponse('Webhook not configured', { status: 503 });
  }
  if (!verified) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  let payload: { id?: string; type?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Bad payload', { status: 400 });
  }

  if (payload.type !== 'cardTransaction' || !payload.id) {
    // Not a transaction event (or an event type we don't handle) — accept
    // and ignore so Helcim doesn't retry it forever.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  let txn;
  try {
    txn = await getCardTransaction(payload.id);
  } catch {
    // Transient Helcim API failure — ask Helcim to retry later.
    return new NextResponse('Could not fetch transaction', { status: 502 });
  }

  if (!txn.invoiceNumber) {
    return NextResponse.json({ ok: true, note: 'No invoiceNumber on transaction' });
  }

  const { data: intent } = await admin
    .from('payment_intents')
    .select('id, family_member_id, payment_plan_id, category, amount, status, save_card')
    .eq('reference', txn.invoiceNumber)
    .maybeSingle();

  if (!intent) {
    return NextResponse.json({ ok: true, note: 'No matching payment_intents row' });
  }

  const approved = txn.status.toUpperCase() === 'APPROVED';

  if (approved) {
    // Idempotent: the unique index on payments.helcim_transaction_id means a
    // webhook retry silently no-ops the second insert.
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
      .then(() => {}, () => {}); // ignore unique-violation on retry

    await admin
      .from('payment_intents')
      .update({ status: 'completed', helcim_transaction_id: txn.transactionId })
      .eq('id', intent.id);

    // Capture the stored card and flip auto_charge on only if the family
    // explicitly checked "save card for automatic payments" on this checkout.
    if (txn.cardToken && intent.payment_plan_id && intent.save_card) {
      await admin
        .from('payment_plans')
        .update({
          stored_card_token: txn.cardToken,
          stored_customer_code: txn.customerCode ?? null,
          auto_charge: true,
        })
        .eq('id', intent.payment_plan_id);
    }
  } else {
    await admin
      .from('payment_intents')
      .update({ status: 'failed', helcim_transaction_id: txn.transactionId })
      .eq('id', intent.id);
  }

  return NextResponse.json({ ok: true });
}
