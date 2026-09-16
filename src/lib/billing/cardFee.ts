/**
 * Helcim's Fee Saver passes the card processing fee to the payer. The hosted
 * checkout applies it for us (`hasConvenienceFee` — see initializeCheckout),
 * which is why a family paying their own $665 installment is charged $684.95.
 *
 * The Payment API has no equivalent: its purchase body has no convenience-fee
 * field at all, so a stored-card charge went through at the bare installment
 * amount and the school quietly absorbed the fee. Anything charging a stored
 * card has to add it here instead.
 *
 * Bank (ACH/EFT) payments are deliberately excluded — a fee-free bank option
 * is the other half of how Fee Saver works.
 *
 * The rate must match what Helcim is configured to charge at checkout, or the
 * two payment routes bill families differently for the same installment. Set
 * HELCIM_CARD_FEE_PERCENT if that rate ever changes.
 */

const DEFAULT_CARD_FEE_PERCENT = 3;

export function cardFeePercent(): number {
  const configured = Number(process.env.HELCIM_CARD_FEE_PERCENT);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_CARD_FEE_PERCENT;
}

/** The installment amount plus the card fee, rounded to cents. */
export function withCardFee(amount: number): number {
  return Math.round(amount * (1 + cardFeePercent() / 100) * 100) / 100;
}

/** Just the fee portion — for telling someone what they're about to charge. */
export function cardFeeOn(amount: number): number {
  return Math.round((withCardFee(amount) - amount) * 100) / 100;
}
