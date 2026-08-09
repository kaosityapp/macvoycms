-- The webhook (src/app/api/webhooks/helcim/route.ts) relies on
-- helcim_transaction_id being unique to make a retried webhook delivery a
-- safe no-op instead of double-inserting the same payment.
create unique index if not exists payments_helcim_transaction_id_unique
  on payments (helcim_transaction_id)
  where helcim_transaction_id is not null;
