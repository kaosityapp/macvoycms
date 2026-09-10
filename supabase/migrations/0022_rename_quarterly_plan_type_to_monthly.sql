-- No existing rows use 'quarterly' (confirmed before migration), so this is
-- a clean rename rather than a data backfill.
alter table payment_plans drop constraint payment_plans_plan_type_check;
alter table payment_plans add constraint payment_plans_plan_type_check
  check (plan_type = any (array['monthly'::text, 'paid_in_full'::text, 'custom'::text, 'awaiting_choice'::text]));
