/**
 * Helcim payments integration (fee-saver enabled — customer pays the
 * processing fee). Spec §2, §3.3.
 *
 * NOT WIRED YET — no API token provisioned. These functions define the shape
 * the rest of the app codes against; the bodies throw until HELCIM_API_TOKEN
 * is set and the real calls are implemented. Swap the throwing bodies for
 * fetch() calls to Helcim's API without changing any call sites.
 */

export interface InstallmentScheduleItem {
  /** ISO date (YYYY-MM-DD) the installment is charged. */
  date: string;
  amount: number;
}

export interface CreateSubscriptionInput {
  familyMemberId: string;
  totalAmount: number;
  schedule: InstallmentScheduleItem[];
  customerEmail: string;
  description: string;
}

export interface CreateSubscriptionResult {
  helcimSubscriptionId: string;
}

export interface OneTimeChargeInput {
  familyMemberId: string;
  amount: number;
  description: string;
  customerEmail: string;
}

export interface OneTimeChargeResult {
  helcimTransactionId: string;
}

const NOT_CONFIGURED =
  'Helcim is not configured yet (HELCIM_API_TOKEN missing). Implement before enabling payments.';

function assertConfigured(): string {
  const token = process.env.HELCIM_API_TOKEN;
  if (!token) throw new Error(NOT_CONFIGURED);
  return token;
}

/** Create an installment subscription (quarterly / custom plans). */
export async function createSubscription(
  _input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  assertConfigured();
  throw new Error('createSubscription not implemented — awaiting Helcim setup.');
}

/** Charge a one-time amount (pay-in-full tuition, add-ons, costume rental). */
export async function createOneTimeCharge(
  _input: OneTimeChargeInput,
): Promise<OneTimeChargeResult> {
  assertConfigured();
  throw new Error('createOneTimeCharge not implemented — awaiting Helcim setup.');
}

/**
 * Stop future scheduled charges on a subscription. Per the no-refund policy
 * (spec §3.3) this NEVER issues a refund — it only halts upcoming installments.
 */
export async function stopSubscription(_helcimSubscriptionId: string): Promise<void> {
  assertConfigured();
  throw new Error('stopSubscription not implemented — awaiting Helcim setup.');
}

/** Verify an incoming Helcim webhook signature. */
export function verifyWebhookSignature(_payload: string, _signature: string): boolean {
  if (!process.env.HELCIM_WEBHOOK_SECRET) throw new Error(NOT_CONFIGURED);
  throw new Error('verifyWebhookSignature not implemented — awaiting Helcim setup.');
}

export function isHelcimConfigured(): boolean {
  return Boolean(process.env.HELCIM_API_TOKEN);
}
