alter table family_accounts add column parent2_auth_user_id uuid references auth.users(id);
create unique index family_accounts_parent2_auth_user_id_key on family_accounts(parent2_auth_user_id) where parent2_auth_user_id is not null;

create or replace function current_family_account_id()
returns uuid
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select id from family_accounts
  where auth_user_id = auth.uid() or parent2_auth_user_id = auth.uid();
$$;

create or replace function owns_family_member(fm_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from family_members fm
    join family_accounts fa on fa.id = fm.family_account_id
    where fm.id = fm_id
      and (fa.auth_user_id = auth.uid() or fa.parent2_auth_user_id = auth.uid())
  );
$$;

drop policy "own account read" on family_accounts;
create policy "own account read" on family_accounts for select
  using (auth_user_id = auth.uid() or parent2_auth_user_id = auth.uid() or is_admin());

drop policy "own account update" on family_accounts;
create policy "own account update" on family_accounts for update
  using (auth_user_id = auth.uid() or parent2_auth_user_id = auth.uid() or is_admin())
  with check (auth_user_id = auth.uid() or parent2_auth_user_id = auth.uid() or is_admin());
