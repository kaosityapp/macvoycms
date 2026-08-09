-- "Remove Student" soft-disables a dancer (record kept), distinct from a hard
-- delete. Active is the default.
alter table family_members
  add column if not exists status text not null default 'active'
  check (status in ('active', 'removed'));
