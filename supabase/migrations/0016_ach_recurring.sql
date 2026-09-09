-- ===========================================================================
-- Recurring bank (ACH/EFT) payments. Card recurring stores a cardToken and
-- gets a same-day approve/decline via webhook; ACH is different — Helcim
-- confirms no dedicated webhook event exists for it, so settlement (which
-- can take days) is discovered by polling GET /ach/transactions/{id} from
-- the daily cron. See src/lib/billing/autoCharge.ts and
-- src/app/api/cron/charge-installments/route.ts.
-- ===========================================================================

-- payment_plans: the bank-account equivalent of stored_card_token/
-- stored_customer_code. Charging a stored bank account needs BOTH Helcim's
-- numeric customerId and bankAccountId (not a single opaque token).
alter table payment_plans
  add column if not exists stored_bank_customer_id text,
  add column if not exists stored_bank_account_id  text;

-- payment_intents: capture what HelcimPay.js's browser callback gives us for
-- a bank payment, plus the resolved IDs looked up right after (customerCode
-- -> numeric customerId via GET /customers; bankAccountId via the ACH
-- transaction lookup).
alter table payment_intents
  add column if not exists bank_token         text,
  add column if not exists bank_customer_code text,
  add column if not exists bank_account_id    text,
  add column if not exists bank_customer_id   text;

-- 'settling': a bank withdrawal was created (PUT /ach/withdraw succeeded or
-- the customer completed HelcimPay.js) but not yet confirmed settled —
-- distinct from 'client_confirmed' (which for cards means "webhook will
-- finalize within seconds"); ACH settlement is checked once daily and can
-- take days, so this status needs its own meaning for admin-facing display.
alter table payment_intents drop constraint payment_intents_status_check;
alter table payment_intents add constraint payment_intents_status_check
  check (status in ('pending','client_confirmed','completed','failed','expired','settling'));

alter table payments drop constraint payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('helcim', 'ach', 'cash', 'e-transfer', 'cheque', 'other'));
