-- ===========================================================================
-- Row-Level Security
-- Model: two roles. Admin (Debbie) sees/does everything. A parent sees only
-- their own family_account and everything hanging off it. Reference/catalog
-- data (locations, seasons, classes, sessions, rate card) is world-readable so
-- the public site and registration form work without a login.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER so they run as the owner and bypass RLS
-- on the tables they read — this avoids policy recursion (e.g. a policy on
-- family_members that needs to read family_accounts).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function public.current_family_account_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from family_accounts where auth_user_id = auth.uid();
$$;

create or replace function public.owns_family_member(fm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from family_members fm
    join family_accounts fa on fa.id = fm.family_account_id
    where fm.id = fm_id and fa.auth_user_id = auth.uid()
  );
$$;

-- Is a sent announcement targeted at the given family account?
create or replace function public.announcement_targets_account(a_id uuid, fa_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  a announcements;
begin
  select * into a from announcements where id = a_id;
  if a.id is null or a.sent_at is null or fa_id is null then
    return false;
  end if;

  if a.audience_type = 'all' then
    return true;

  elsif a.audience_type = 'location' then
    return exists (
      select 1
      from enrollments e
      join family_members fm on fm.id = e.family_member_id
      join classes c on c.id = e.class_id
      where fm.family_account_id = fa_id
        and e.status = 'active'
        and c.location_id = (a.audience_ref->>'location_id')::uuid
    );

  elsif a.audience_type = 'class' then
    return exists (
      select 1
      from enrollments e
      join family_members fm on fm.id = e.family_member_id
      where fm.family_account_id = fa_id
        and e.status = 'active'
        and e.class_id in (
          select (jsonb_array_elements_text(a.audience_ref->'class_ids'))::uuid
        )
    );

  elsif a.audience_type = 'individual' then
    return exists (
      select 1
      from family_members fm
      where fm.family_account_id = fa_id
        and fm.id in (
          select (jsonb_array_elements_text(a.audience_ref->'family_member_ids'))::uuid
        )
    );
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table locations          enable row level security;
alter table seasons            enable row level security;
alter table classes            enable row level security;
alter table class_sessions     enable row level security;
alter table family_accounts    enable row level security;
alter table admins             enable row level security;
alter table family_members     enable row level security;
alter table consents           enable row level security;
alter table enrollments        enable row level security;
alter table rate_card          enable row level security;
alter table order_items        enable row level security;
alter table payment_plans      enable row level security;
alter table payments           enable row level security;
alter table announcements      enable row level security;
alter table announcement_reads enable row level security;

-- ---------------------------------------------------------------------------
-- Catalog / reference tables: public read, admin write
-- ---------------------------------------------------------------------------
create policy "catalog read" on locations      for select using (true);
create policy "catalog read" on seasons        for select using (true);
create policy "catalog read" on classes        for select using (true);
create policy "catalog read" on class_sessions for select using (true);
create policy "catalog read" on rate_card      for select using (true);

create policy "admin write" on locations      for all using (is_admin()) with check (is_admin());
create policy "admin write" on seasons        for all using (is_admin()) with check (is_admin());
create policy "admin write" on classes        for all using (is_admin()) with check (is_admin());
create policy "admin write" on class_sessions for all using (is_admin()) with check (is_admin());
create policy "admin write" on rate_card      for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- admins: readable by admins only; managed out-of-band (service role / SQL)
-- ---------------------------------------------------------------------------
create policy "admin read" on admins for select using (is_admin());

-- ---------------------------------------------------------------------------
-- family_accounts: a parent sees/edits their own row; admin sees all.
-- (Row creation during registration runs server-side via the service role,
--  which bypasses RLS, so no public INSERT policy is exposed here.)
-- ---------------------------------------------------------------------------
create policy "own account read"   on family_accounts for select using (auth_user_id = auth.uid() or is_admin());
create policy "own account update" on family_accounts for update using (auth_user_id = auth.uid() or is_admin()) with check (auth_user_id = auth.uid() or is_admin());
create policy "admin account write" on family_accounts for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- family_members & everything scoped through a member
-- ---------------------------------------------------------------------------
create policy "own members read"  on family_members for select
  using (family_account_id = current_family_account_id() or is_admin());
create policy "own members write" on family_members for all
  using (family_account_id = current_family_account_id() or is_admin())
  with check (family_account_id = current_family_account_id() or is_admin());

-- consents: parent can read/create for own dancers; never update/delete
-- (an agreed consent is an immutable record). Admin full access.
create policy "own consents read"   on consents for select using (owns_family_member(family_member_id) or is_admin());
create policy "own consents insert" on consents for insert with check (owns_family_member(family_member_id) or is_admin());
create policy "admin consents write" on consents for all using (is_admin()) with check (is_admin());

create policy "own enrollments read"  on enrollments for select using (owns_family_member(family_member_id) or is_admin());
create policy "admin enrollments write" on enrollments for all using (is_admin()) with check (is_admin());

create policy "own order_items read"  on order_items for select using (owns_family_member(family_member_id) or is_admin());
create policy "admin order_items write" on order_items for all using (is_admin()) with check (is_admin());

create policy "own plans read"  on payment_plans for select using (owns_family_member(family_member_id) or is_admin());
create policy "admin plans write" on payment_plans for all using (is_admin()) with check (is_admin());

create policy "own payments read"  on payments for select using (owns_family_member(family_member_id) or is_admin());
create policy "admin payments write" on payments for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- announcements: parents read only sent ones targeted at them; admin full.
-- ---------------------------------------------------------------------------
create policy "targeted announcements read" on announcements for select
  using (is_admin() or announcement_targets_account(id, current_family_account_id()));
create policy "admin announcements write" on announcements for all
  using (is_admin()) with check (is_admin());

-- announcement_reads: a parent manages their own read receipts; admin reads all.
create policy "own reads select" on announcement_reads for select
  using (family_account_id = current_family_account_id() or is_admin());
create policy "own reads insert" on announcement_reads for insert
  with check (family_account_id = current_family_account_id());
