-- Allow 'voided' on payment_intents.
--
-- When Helcim voids or refunds a charge, the webhook reverses our payment and
-- marks the intent voided so the duplicate-charge guard stops blocking a fresh
-- attempt on that installment. The status CHECK predated reversals and didn't
-- list it, so that update was rejected — leaving the intent 'completed' and
-- the installment un-rechargeable, with nothing surfaced because the update's
-- error was never inspected (fixed in the webhook alongside this).
alter table payment_intents drop constraint if exists payment_intents_status_check;

alter table payment_intents add constraint payment_intents_status_check
  check (status in ('pending', 'client_confirmed', 'completed', 'failed', 'expired', 'settling', 'voided'));
