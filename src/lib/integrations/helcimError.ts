/**
 * Carries the parsed response body, because Helcim returns a declined card as
 * a NON-2xx: a real issuer decline came back as HTTP 500 whose body was a
 * complete transaction object with status DECLINED and "Transaction Declined:
 * SUSPECTED FRAUD".
 *
 * Without the body that reads as "our request was broken", and the admin gets
 * told the card was never reached — when in fact it was, and the bank refused
 * it. The two need completely different responses, so they have to be told
 * apart here.
 */
export class HelcimApiError extends Error {
  readonly httpStatus: number;
  readonly body: Record<string, unknown> | null;

  constructor(message: string, httpStatus: number, rawBody: string) {
    super(message);
    this.name = 'HelcimApiError';
    this.httpStatus = httpStatus;
    let parsed: Record<string, unknown> | null = null;
    try {
      const value = JSON.parse(rawBody);
      if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
    } catch {
      // Not JSON — a gateway error page, say. Leave body null.
    }
    this.body = parsed;
  }

  /** The transaction, when the body turned out to be one that was declined. */
  get declinedTransaction(): { transactionId: string; reason: string } | null {
    const body = this.body;
    if (!body || String(body.status ?? '').toUpperCase() !== 'DECLINED') return null;
    const reason = String(body.errors ?? '').trim() || 'Declined by the card issuer';
    return { transactionId: String(body.transactionId ?? ''), reason };
  }
}
