-- ===========================================================================
-- Staging table for Debbie's spreadsheet of known/returning families. When a
-- family's email matches a row here, registration pre-fills their dancer(s),
-- classes, and payment plan(s) — they only verify via magic link, set a
-- password, agree to waivers, and submit. Matched once, then marked completed
-- so the same row can't be replayed.
-- ===========================================================================

create table pending_registrations (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  parent1_name      text,
  parent1_phone     text,
  parent2_name      text,
  parent2_phone     text,
  parent2_email     text,
  referral_source   referral_source,
  -- One entry per dancer: { first_name, last_name, birthday, gender, address,
  -- medical_notes, emergency_contact_name, emergency_contact_phone,
  -- emergency_contact_relationship, class_ids: uuid[], addon,
  -- plan_type, total_amount, installment_schedule: [{date, amount}] }
  dancers           jsonb not null default '[]'::jsonb,
  status            text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index pending_registrations_email_unique on pending_registrations (lower(email));
create index pending_registrations_status_idx on pending_registrations (status);

create trigger trg_pending_registrations_updated
  before update on pending_registrations
  for each row execute function public.set_updated_at();

alter table pending_registrations enable row level security;

-- Admin manages the import directly; no public SELECT policy at all — the
-- server-side check (service-role client) is the only way to look this up,
-- so a match can never be enumerated by a client-side query.
create policy "admin manage pending_registrations" on pending_registrations
  for all using (is_admin()) with check (is_admin());
