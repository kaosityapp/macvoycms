import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyWebhookSignature, getCardTransaction } from '@/lib/integrations/helcim';
import { dancerNameFor } from '@/lib/billing/autoCharge';
import { sendAdminAlert, sendPlainEmail } from '@/lib/integrations/adminAlert';
import { money, formatDateLong } from '@/lib/format';

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
/**
 * Plain reachability check — some webhook dashboards (possibly Helcim's own
 * config-save flow) probe the Deliver URL with a GET before accepting it.
 * No signature check here; it does nothing but confirm the endpoint exists.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}

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

    // Receipt to the family — Helcim's own account notifications only go to
    // the merchant contact (Debbie), not the customer, so this is the only
    // thing that actually emails the person who paid.
    const { data: receiptDancer } = await admin
      .from('family_members')
      .select('first_name, last_name, family:family_accounts(parent1_email)')
      .eq('id', intent.family_member_id)
      .maybeSingle();
    const parentEmail = (receiptDancer as any)?.family?.parent1_email;
    if (parentEmail) {
      const paidAmount = Number(txn.amount || intent.amount);
      await sendPlainEmail(
        parentEmail,
        `Payment received — ${money(paidAmount)} — MacVoy School of Irish Dance`,
        [
          `We received your payment of ${money(paidAmount)} for ${receiptDancer?.first_name} ${receiptDancer?.last_name}, paid ${formatDateLong(new Date().toISOString().slice(0, 10))}.`,
          `Reference: ${txn.transactionId}`,
          `You can see your full payment history anytime at https://www.macvoyirishdance.com/dashboard/payments`,
        ],
      );
    }

    // Capture the stored card and flip auto_charge on only if the family
    // explicitly checked "save card for automatic payments" on this checkout.
    if (intent.save_card && intent.payment_plan_id) {
      if (txn.cardToken) {
        await admin
          .from('payment_plans')
          .update({
            stored_card_token: txn.cardToken,
            stored_customer_code: txn.customerCode ?? null,
            auto_charge: true,
          })
          .eq('id', intent.payment_plan_id);
      } else {
        // They checked "save for automatic payments" but paid via ACH bank
        // payment instead of card — there's no card token to store, so
        // recurring can't be set up. Silently doing nothing here would leave
        // the family believing they opted in when nothing actually happened.
        const dancerName = await dancerNameFor(admin, intent.family_member_id);
        await sendAdminAlert(`Auto-charge NOT set up for ${dancerName} — paid via bank payment`, [
          `${dancerName}'s family checked "save for automatic payments" but paid via ACH bank transfer instead of credit card.`,
          `Automatic payments only work with a saved credit card, so nothing was saved — they'll need to use Pay Now each time, or pay by card and check the box again to enable it.`,
        ]);
      }
    }
  } else {
    await admin
      .from('payment_intents')
      .update({ status: 'failed', helcim_transaction_id: txn.transactionId })
      .eq('id', intent.id);
  }

  return NextResponse.json({ ok: true });
}
