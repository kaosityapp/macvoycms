/**
 * Helcim payments integration (fee-saver enabled — customer pays the
 * processing fee). Spec §2, §3.3.
 *
 * Two payment paths:
 *  - On-demand "Pay Now": HelcimPay.js hosted checkout modal. Card data never
 *    touches our server. See src/app/dashboard/payments/PayNowButton.tsx.
 *  - Automatic recurring: after a parent opts in and saves a card via the
 *    modal, a daily cron (src/app/api/cron/charge-installments/route.ts)
 *    charges the stored card token for each due installment via the Payment
 *    API. Never enabled by default — a family must opt in per plan.
 *
 * The webhook (src/app/api/webhooks/helcim/route.ts) is the single source of
 * truth for recording a completed payment — the client-side confirmation is
 * only used for fast UI feedback.
 *
 * Reference: https://devdocs.helcim.com/docs/overview-of-helcimpayjs
 */

import { createHmac, createHash } from 'crypto';

const API_BASE = 'https://api.helcim.com/v2';

const NOT_CONFIGURED =
  'Helcim is not configured yet (HELCIM_API_TOKEN missing). Implement before enabling payments.';

function apiToken(): string {
  const token = process.env.HELCIM_API_TOKEN;
  if (!token) throw new Error(NOT_CONFIGURED);
  return token;
}

async function helcimFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const headers: Record<string, string> = {
    'api-token': apiToken(),
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Helcim API error ${res.status} on ${path}: ${detail}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// HelcimPay.js checkout session (on-demand "Pay Now")
// ---------------------------------------------------------------------------

export interface InitCheckoutInput {
  amount: number;
  /** Our internal reference — becomes the Helcim invoice number, letting the
   *  webhook trace a transaction back to a payment_intents row. */
  reference: string;
  /** Line-item description shown on the Helcim invoice/receipt. */
  description?: string;
  customerEmail?: string;
  /** Parent opted in to save the card for future automatic charges. */
  saveCard?: boolean;
  currency?: 'CAD' | 'USD';
}

export interface InitCheckoutResult {
  checkoutToken: string;
  secretToken: string;
}

/** Create a HelcimPay.js checkout session. Tokens are valid for 60 minutes. */
export async function initializeCheckout(input: InitCheckoutInput): Promise<InitCheckoutResult> {
  const data = await helcimFetch('/helcim-pay/initialize', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency ?? 'CAD',
      paymentType: 'purchase',
      // invoiceRequest CREATES a new invoice under our reference (the
      // top-level invoiceNumber field instead tries to LINK an existing
      // invoice and 400s with "Invalid Invoice Number" since none exists).
      // Once invoiceRequest is included, Helcim requires lineItems whose
      // total matches `amount`.
      invoiceRequest: {
        invoiceNumber: input.reference,
        lineItems: [
          {
            description: input.description ?? 'MacVoy Tuition Payment',
            quantity: 1,
            price: input.amount,
            total: input.amount,
          },
        ],
      },
      ...(input.customerEmail
        ? { customerRequest: { email: input.customerEmail } }
        : {}),
      ...(input.saveCard ? { setAsDefaultPaymentMethod: 1 } : {}),
    }),
  });
  if (!data.checkoutToken || !data.secretToken) {
    throw new Error('Helcim initialize did not return a checkoutToken/secretToken.');
  }
  return { checkoutToken: data.checkoutToken, secretToken: data.secretToken };
}

/**
 * Validate the client-side HelcimPay.js result (fast-path UI confirmation
 * only — the webhook is what actually records the payment). Per Helcim docs:
 * sha256(JSON.stringify(data) + secretToken) must equal the returned hash.
 */
export function validateClientHash(data: unknown, hash: string, secretToken: string): boolean {
  const computed = createHash('sha256').update(JSON.stringify(data) + secretToken).digest('hex');
  return computed === hash;
}

// ---------------------------------------------------------------------------
// Stored-card charging (automatic recurring, opt-in only)
// ---------------------------------------------------------------------------

export interface ChargeStoredCardInput {
  amount: number;
  cardToken: string;
  reference: string;
  ipAddress?: string;
  currency?: 'CAD' | 'USD';
}

export interface ChargeResult {
  transactionId: string;
  status: string;
  approved: boolean;
}

/** Charge a previously-saved card token (used by the recurring-charge cron). */
export async function chargeStoredCard(input: ChargeStoredCardInput): Promise<ChargeResult> {
  const data = await helcimFetch('/payment/purchase', {
    method: 'POST',
    idempotencyKey: input.reference,
    body: JSON.stringify({
      ipAddress: input.ipAddress ?? '0.0.0.0',
      amount: input.amount,
      currency: input.currency ?? 'CAD',
      invoiceNumber: input.reference,
      cardData: { cardToken: input.cardToken },
    }),
  });
  const status = String(data.status ?? '').toUpperCase();
  return { transactionId: String(data.transactionId ?? ''), status, approved: status === 'APPROVED' };
}

// ---------------------------------------------------------------------------
// Webhook verification + transaction lookup
// ---------------------------------------------------------------------------

export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

/**
 * Verify a Helcim webhook's HMAC-SHA256 signature.
 * Payload = `${webhook-id}.${webhook-timestamp}.${rawBody}`, signed with the
 * base64-decoded verifier token (HELCIM_WEBHOOK_SECRET), base64-encoded, and
 * compared against the webhook-signature header (after its "v1," prefix).
 */
export function verifyWebhookSignature(rawBody: string, headers: WebhookHeaders): boolean {
  const secret = process.env.HELCIM_WEBHOOK_SECRET;
  if (!secret) throw new Error(NOT_CONFIGURED);

  const payload = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const key = Buffer.from(secret, 'base64');
  const expected = createHmac('sha256', key).update(payload).digest('base64');

  const received = headers.signature.startsWith('v1,')
    ? headers.signature.slice(3)
    : headers.signature;

  // Constant-time-ish comparison (lengths must match for timingSafeEqual).
  if (expected.length !== received.length) return false;
  return require('crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export interface CardTransaction {
  transactionId: string;
  status: string;
  amount: number;
  invoiceNumber?: string;
  cardToken?: string;
  customerCode?: string;
}

/** Fetch full transaction details by id (webhooks only carry the id). */
export async function getCardTransaction(id: string): Promise<CardTransaction> {
  const data = await helcimFetch(`/card-transactions/${id}`, { method: 'GET' });
  return {
    transactionId: String(data.transactionId ?? id),
    status: String(data.status ?? ''),
    amount: Number(data.amount ?? 0),
    invoiceNumber: data.invoiceNumber ? String(data.invoiceNumber) : undefined,
    cardToken: data.cardToken ? String(data.cardToken) : undefined,
    customerCode: data.customerCode ? String(data.customerCode) : undefined,
  };
}

export function isHelcimConfigured(): boolean {
  return Boolean(process.env.HELCIM_API_TOKEN);
}

export function isHelcimWebhookConfigured(): boolean {
  return Boolean(process.env.HELCIM_WEBHOOK_SECRET);
}
