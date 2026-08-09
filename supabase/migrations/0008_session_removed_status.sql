-- Allow a 'removed' session status: hidden from the parents' calendar entirely
-- (as opposed to 'cancelled', which stays visible but struck through with a note).
alter table class_sessions drop constraint if exists class_sessions_status_check;
alter table class_sessions
  add constraint class_sessions_status_check
  check (status in ('scheduled', 'cancelled', 'rescheduled', 'removed'));
