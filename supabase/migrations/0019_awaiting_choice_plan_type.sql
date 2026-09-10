-- 'awaiting_choice': Debbie approved a pending_pricing dancer with just a
-- total price (no installments) and the family picks quarterly vs
-- paid-in-full themselves once they see the price — see
-- admin/families/actions.ts (approveWithTotalPrice) and
-- dashboard/payments/actions.ts (chooseFamilyPlan).
alter table payment_plans drop constraint payment_plans_plan_type_check;
alter table payment_plans add constraint payment_plans_plan_type_check
  check (plan_type in ('quarterly', 'paid_in_full', 'custom', 'awaiting_choice'));
