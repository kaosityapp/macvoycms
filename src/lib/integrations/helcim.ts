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

import { createHmac, createHash, randomUUID } from 'crypto';

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
  /** Required by Helcim as customerRequest.contactName once customerRequest is sent. */
  customerName?: string;
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
      // Fee Saver (customer pays the ~3% card processing fee) is NOT applied
      // just because it's enabled at the account level — each checkout
      // session must explicitly request it via these two fields, or Helcim
      // silently charges the flat amount with the school absorbing the fee.
      // paymentMethod 'cc-ach' is required alongside it (gives the customer
      // a fee-free bank-payment alternative to card). Confirmed against
      // Helcim's dev docs: devdocs.helcim.com/docs/processing-with-fee-saver-through-helcimpayjs
      hasConvenienceFee: 1,
      paymentMethod: 'cc-ach',
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
      // customerRequest requires contactName once included at all.
      ...(input.customerName || input.customerEmail
        ? {
            customerRequest: {
              contactName: input.customerName || input.customerEmail,
              ...(input.customerEmail ? { email: input.customerEmail } : {}),
            },
          }
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

/**
 * Search for a card transaction by our invoiceNumber (reference) — used by
 * the reconciliation poller to find a transaction the webhook never
 * reported (e.g. HELCIM_WEBHOOK_SECRET misconfigured, endpoint briefly
 * down, webhook retries exhausted). Returns null if nothing matches yet.
 */
export async function findCardTransactionByInvoice(invoiceNumber: string): Promise<CardTransaction | null> {
  const data = await helcimFetch(`/card-transactions?invoiceNumber=${encodeURIComponent(invoiceNumber)}`, {
    method: 'GET',
  });
  const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  const match = list[0];
  if (!match) return null;
  return {
    transactionId: String(match.transactionId ?? ''),
    status: String(match.status ?? ''),
    amount: Number(match.amount ?? 0),
    invoiceNumber: match.invoiceNumber ? String(match.invoiceNumber) : undefined,
    cardToken: match.cardToken ? String(match.cardToken) : undefined,
    customerCode: match.customerCode ? String(match.customerCode) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Recurring bank (ACH/EFT) payments.
//
// Structurally different from cards: there's no confirmed Helcim webhook
// event for ACH (per Helcim support), and charging a stored bank account
// needs Helcim's numeric customerId + bankAccountId (not one opaque token).
// Settlement is asynchronous and can take days, discovered by polling
// GET /ach/transactions/{id} — statusAuth 1 + statusClearing 1 means
// actually settled; a 200 from the withdraw call only means the withdrawal
// was *created*, not that funds cleared. See migration 0016 + autoCharge.ts.
// ---------------------------------------------------------------------------

/** Resolve Helcim's numeric customerId from the customerCode HelcimPay.js returns. */
export async function lookupCustomerIdByCode(customerCode: string): Promise<string | null> {
  const data = await helcimFetch(`/customers?customerCode=${encodeURIComponent(customerCode)}`, {
    method: 'GET',
  });
  const match = Array.isArray(data) ? data[0] : Array.isArray(data?.data) ? data.data[0] : data;
  return match?.id != null ? String(match.id) : null;
}

export interface AchTransaction {
  id: string;
  bankAccountId: string | null;
  amount: number;
  invoiceNumber?: string;
  customerCode?: string;
  /** 1=Approved, 2=Declined, 4=Voided/cancelled, 5=Awaiting bank authorization. */
  statusAuth: number | null;
  /** 0=In progress, 1=Settled/approved, 4=Settled/declined. */
  statusClearing: number | null;
}

/** Poll a bank transaction's current settlement status. */
export async function getAchTransaction(id: string): Promise<AchTransaction> {
  const data = await helcimFetch(`/ach/transactions/${id}`, { method: 'GET' });
  return {
    id: String(data.id ?? id),
    bankAccountId: data.bankAccountId != null ? String(data.bankAccountId) : null,
    amount: Number(data.amount ?? 0),
    invoiceNumber: data.invoiceNumber ? String(data.invoiceNumber) : undefined,
    customerCode: data.customerCode ? String(data.customerCode) : undefined,
    statusAuth: data.statusAuth != null ? Number(data.statusAuth) : null,
    statusClearing: data.statusClearing != null ? Number(data.statusClearing) : null,
  };
}

/**
 * Find a bank (ACH/EFT) transaction by our invoiceNumber — a backstop for
 * when a family's own bank confirmation (confirmPaymentClientSide) never
 * reaches us (e.g. they closed the tab right after paying), which otherwise
 * leaves the payment_intent stuck at 'pending' forever with no bank_token,
 * indistinguishable from a genuinely-abandoned CARD checkout. Helcim's list
 * endpoint doesn't actually filter server-side by invoiceNumber (confirmed
 * empirically — it ignores the query param), so this fetches a recent window
 * and matches client-side.
 */
export async function findAchTransactionByInvoice(invoiceNumber: string): Promise<AchTransaction | null> {
  const from = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const data = await helcimFetch(
    `/ach/transactions?dateCreatedFrom=${encodeURIComponent(from)}&limit=300`,
    { method: 'GET' },
  );
  const list: any[] = Array.isArray(data?.transactions) ? data.transactions : [];
  const match = list.find((t) => t.invoiceNumber === invoiceNumber);
  if (!match) return null;
  return {
    id: String(match.id),
    bankAccountId: match.bankAccountId != null ? String(match.bankAccountId) : null,
    amount: Number(match.amount ?? 0),
    invoiceNumber: match.invoiceNumber ? String(match.invoiceNumber) : undefined,
    customerCode: match.customerCode ? String(match.customerCode) : undefined,
    statusAuth: match.statusAuth != null ? Number(match.statusAuth) : null,
    statusClearing: match.statusClearing != null ? Number(match.statusClearing) : null,
  };
}

export interface ChargeStoredBankAccountInput {
  amount: number;
  bankAccountId: string;
  customerId: string;
  currency?: 'CAD' | 'USD';
}

export interface WithdrawResult {
  transactionId: string;
}

/**
 * Initiate a withdrawal from a previously-saved bank account (recurring
 * cron only). Success here means the withdrawal was *created* — it is NOT
 * settled yet. The cron polls getAchTransaction on subsequent runs to find
 * out whether it actually cleared.
 */
export async function chargeStoredBankAccount(input: ChargeStoredBankAccountInput): Promise<WithdrawResult> {
  const data = await helcimFetch('/ach/withdraw', {
    method: 'PUT',
    idempotencyKey: randomUUID(),
    body: JSON.stringify({
      bankAccountId: Number(input.bankAccountId),
      customerId: Number(input.customerId),
      amount: input.amount,
      currencyId: input.currency === 'USD' ? 2 : 1,
    }),
  });
  const transactionId = data.transaction?.id ?? data.id;
  if (transactionId == null) {
    throw new Error('Helcim ACH withdraw did not return a transaction id.');
  }
  return { transactionId: String(transactionId) };
}

export function isHelcimConfigured(): boolean {
  return Boolean(process.env.HELCIM_API_TOKEN);
}

export function isHelcimWebhookConfigured(): boolean {
  return Boolean(process.env.HELCIM_WEBHOOK_SECRET);
}

// ---------------------------------------------------------------------------
// Batches & deposits (admin "Bank Deposits" tab).
//
// Helcim's API has no "when was this deposited" field anywhere — batches
// only carry open/close dates. The estimatedDepositDate below is OUR
// calculation from Helcim's published payout policy (business days after
// close, skipping weekends — NOT statutory holidays, which Helcim's own
// timeline page says also push it out), not a value Helcim returns. Always
// pair it with a link to https://learn.helcim.com/docs/when-to-expect-a-deposit
// rather than presenting it as authoritative.
// ---------------------------------------------------------------------------

export interface BatchSummary {
  id: string;
  method: 'card' | 'ach';
  batchNumber: number | null;
  amount: number;
  dateClosed: string | null;
  /** Our estimate only — see module doc comment above. */
  estimatedDepositDate: string | null;
}

/** Add `n` business days (Mon–Fri only) to a 'YYYY-MM-DD HH:mm:ss'-ish date string. */
function addBusinessDays(dateStr: string, n: number): string {
  const date = new Date(dateStr.replace(' ', 'T'));
  let added = 0;
  while (added < n) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Closed card batches with their net amount (approved purchases minus any
 * reversals/refunds in that batch) — card-batches itself carries no amount,
 * so this cross-references /card-transactions by cardBatchId. Estimated
 * deposit uses the standard (non-Faster-Deposits) 2-business-day window.
 */
export async function listCardBatchesWithAmounts(): Promise<BatchSummary[]> {
  const batchesData = await helcimFetch('/card-batches', { method: 'GET' });
  const batches: any[] = Array.isArray(batchesData) ? batchesData : [];
  const closed = batches.filter((b) => b.closed);
  if (closed.length === 0) return [];

  const oldest = closed.reduce((min: string, b: any) => (b.dateCreated < min ? b.dateCreated : min), closed[0].dateCreated);
  const txnData = await helcimFetch(
    `/card-transactions?dateCreatedFrom=${encodeURIComponent(new Date(oldest.replace(' ', 'T')).toISOString())}&limit=300`,
    { method: 'GET' },
  );
  const txns: any[] = Array.isArray(txnData) ? txnData : Array.isArray(txnData?.data) ? txnData.data : [];

  const totalsByBatch = new Map<number, number>();
  for (const t of txns) {
    if (t.status !== 'APPROVED' || t.cardBatchId == null) continue;
    const sign = t.type === 'reverse' ? -1 : 1;
    totalsByBatch.set(t.cardBatchId, (totalsByBatch.get(t.cardBatchId) ?? 0) + sign * Number(t.amount || 0));
  }

  return closed.map((b) => ({
    id: String(b.id),
    method: 'card' as const,
    batchNumber: b.batchNumber ?? null,
    amount: totalsByBatch.get(b.id) ?? 0,
    dateClosed: b.dateClosed ?? null,
    estimatedDepositDate: b.dateClosed ? addBusinessDays(b.dateClosed, 2) : null,
  }));
}

/**
 * Closed ACH batches with their withdrawal total (Helcim reports this
 * directly, unlike card batches). Estimated deposit uses the standard
 * 5-business-day (upper end of Helcim's stated 3–5 day) window.
 */
export async function listAchBatchesWithAmounts(): Promise<BatchSummary[]> {
  const data = await helcimFetch('/ach/batches', { method: 'GET' });
  const batches: any[] = Array.isArray(data?.batches) ? data.batches : [];
  return batches
    .filter((b) => b.dateClosed)
    .map((b) => ({
      id: String(b.batchId),
      method: 'ach' as const,
      batchNumber: null,
      amount: Number(b.amountWithdrawals ?? 0),
      dateClosed: b.dateClosed ?? null,
      estimatedDepositDate: b.dateClosed ? addBusinessDays(b.dateClosed, 5) : null,
    }));
}
