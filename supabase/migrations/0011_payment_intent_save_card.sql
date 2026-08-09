-- Tracks whether the family requested "save card for automatic payments" on
-- this checkout, so the webhook knows whether to flip auto_charge on the plan
-- once the payment is approved and a card token is captured.
alter table payment_intents add column if not exists save_card boolean not null default false;
