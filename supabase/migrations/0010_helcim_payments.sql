-- ===========================================================================
-- Helcim payment infrastructure.
-- payment_intents: one row per HelcimPay.js checkout session we initialize.
-- The `reference` becomes the Helcim invoiceNumber, so the webhook (which only
-- gets a transaction id) can look up which dancer/installment it belongs to
-- after fetching the full transaction from Helcim.
-- ===========================================================================

create table payment_intents (
  id                    uuid primary key default gen_random_uuid(),
  family_member_id      uuid not null references family_members(id) on delete cascade,
  payment_plan_id       uuid references payment_plans(id) on delete set null,
  installment_index     int,
  category              text not null default 'tuition',
  amount                numeric(10,2) not null,
  reference             text not null unique,
  checkout_token        text,
  secret_token          text,
  status                text not null default 'pending'
                          check (status in ('pending','client_confirmed','completed','failed','expired')),
  helcim_transaction_id text,
  created_at            timestamptz not null default now()
);

create index payment_intents_member_idx on payment_intents(family_member_id);
create index payment_intents_reference_idx on payment_intents(reference);

alter table payment_intents enable row level security;
create policy "own intents read"  on payment_intents for select using (owns_family_member(family_member_id) or is_admin());
create policy "own intents write" on payment_intents for insert with check (owns_family_member(family_member_id) or is_admin());
create policy "admin intents write" on payment_intents for all using (is_admin()) with check (is_admin());

-- Stored card for opt-in automatic recurring charges (never touches our server
-- as raw card data — this is Helcim's own card token).
alter table payment_plans
  add column if not exists stored_card_token    text,
  add column if not exists stored_customer_code text,
  add column if not exists auto_charge          boolean not null default false;

-- Prevent double-recording the same Helcim transaction if the webhook retries.
create unique index if not exists payments_helcim_transaction_unique
  on payments(helcim_transaction_id) where helcim_transaction_id is not null;
