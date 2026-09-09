-- ===========================================================================
-- Manual payment recording. Admin can log a payment Debbie received outside
-- Helcim (e-transfer, cash, cheque) against a dancer's payment history.
-- `method` distinguishes these from Helcim-webhook-recorded rows; `note` is a
-- free-text admin note (e.g. "Interac e-transfer").
-- ===========================================================================

alter table payments
  add column if not exists method text not null default 'helcim'
    check (method in ('helcim', 'cash', 'e-transfer', 'cheque', 'other')),
  add column if not exists note text;

-- Existing rows (all Helcim-webhook-recorded so far) keep the default.
