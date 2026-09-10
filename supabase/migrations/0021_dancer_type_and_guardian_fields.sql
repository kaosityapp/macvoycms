alter table family_members
  add column dancer_type text check (dancer_type in ('adult', 'child')),
  add column guardian1_name text,
  add column guardian1_phone text,
  add column guardian1_email text,
  add column guardian2_name text,
  add column guardian2_phone text,
  add column guardian2_email text;
