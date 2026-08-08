-- ===========================================================================
-- Advisor-driven hardening (applied after the initial provision).
--   • Pin search_path on the functions that lacked it (security lint 0011).
--   • Evaluate auth.uid() once per query in the family_accounts policies
--     (performance lint: auth_rls_initplan).
--   • Add indexes for the two foreign keys that lacked a supporting index.
-- ===========================================================================

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.class_duration_minutes(classes) set search_path = public, pg_temp;
alter function public.generate_class_sessions(uuid, date) set search_path = public, pg_temp;

drop policy "own account read" on family_accounts;
create policy "own account read" on family_accounts for select
  using (auth_user_id = (select auth.uid()) or is_admin());

drop policy "own account update" on family_accounts;
create policy "own account update" on family_accounts for update
  using (auth_user_id = (select auth.uid()) or is_admin())
  with check (auth_user_id = (select auth.uid()) or is_admin());

create index if not exists class_sessions_location_idx on class_sessions(location_id);
create index if not exists announcement_reads_announcement_idx on announcement_reads(announcement_id);
