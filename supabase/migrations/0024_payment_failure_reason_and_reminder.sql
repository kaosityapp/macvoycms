alter table payment_intents add column failure_reason text;
alter table payment_plans add column urgent_reminder_sent_at timestamptz;
