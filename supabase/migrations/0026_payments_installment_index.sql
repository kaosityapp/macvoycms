-- Which installment a payment settles.
--
-- Without this, every surface had to guess: they summed all payments and
-- walked the schedule netting off a running total, so money always landed on
-- the earliest installments regardless of which one the family actually paid.
-- Alicia Sewell paid her 2nd and 3rd installments and skipped the 1st, and the
-- guess put $804 of her $883.74 onto the 1st — hiding the one she still owes
-- and offering Pay Now on two she'd already paid.
--
-- payment_intents has always recorded the real answer; the webhook just never
-- copied it across. Nullable because manual entries (e-transfers, cheques,
-- payments carried forward from Debbie's import) name no installment — those
-- still fall back to oldest-first netting.
alter table payments add column if not exists installment_index integer;

comment on column payments.installment_index is
  'Index into payment_plans.installment_schedule that this payment settles. Null for manual/legacy payments, which are netted oldest-first.';

-- Backfill from the intent that produced each payment. They are 1:1 via the
-- Helcim transaction id, which is unique on both tables.
update payments p
set installment_index = pi.installment_index
from payment_intents pi
where pi.helcim_transaction_id = p.helcim_transaction_id
  and p.helcim_transaction_id is not null
  and pi.installment_index is not null
  and p.installment_index is null;

create index if not exists payments_plan_installment_idx
  on payments (payment_plan_id, installment_index);
