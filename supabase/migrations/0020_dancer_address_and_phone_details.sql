alter table family_members
  add column city text,
  add column province text,
  add column postal_code text,
  add column phone_number text,
  add column phone_type text check (phone_type in ('Mobile', 'Home'));
