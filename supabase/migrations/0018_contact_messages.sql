-- ===========================================================================
-- Contact Us form submissions. Still emailed to Debbie immediately (see
-- src/app/(site)/contact/actions.ts), but also saved here so nothing is lost
-- if an email bounces/gets marked spam, and so admin has a browsable record.
-- ===========================================================================

create table contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  location    text not null check (location in ('Mississauga', 'Pickering')),
  message     text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index contact_messages_created_idx on contact_messages(created_at desc);

alter table contact_messages enable row level security;
-- Public submissions go through the admin (service-role) client from the
-- server action, same pattern as pre-account registration writes — the
-- contact form has no logged-in user to scope an RLS policy to.
create policy "admin contact read"  on contact_messages for select using (is_admin());
create policy "admin contact write" on contact_messages for all    using (is_admin()) with check (is_admin());
