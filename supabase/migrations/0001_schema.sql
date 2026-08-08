-- ===========================================================================
-- MacVoy School of Irish Dance — core schema
-- Ref: MacVoy_Platform_Spec.md §3 (Data Model)
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (spec calls these out explicitly). Class-level descriptors
-- (level / shoe_type / day_of_week / status) are kept as text + CHECK so
-- Debbie can extend them without a type migration.
-- ---------------------------------------------------------------------------
create type app_role as enum ('admin', 'parent');

create type referral_source as enum (
  'internet_search',
  'social_media',
  'local_irish_club',
  'word_of_mouth',
  'returning_dancer',
  'restyling_transfer'
);

create type consent_type as enum (
  'liability',
  'media',
  'code_of_conduct',
  'attire',
  'costume_rental',
  'fee_cancellation'
);

create type audience_type as enum ('all', 'location', 'class', 'individual');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- 3.1 Locations & Classes
-- ===========================================================================

create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,               -- e.g. "2026–2027"
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint seasons_date_order check (end_date >= start_date)
);

create table classes (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  location_id   uuid not null references locations(id) on delete restrict,
  day_of_week   text not null
                  check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time    time not null,
  end_time      time not null,
  name          text not null,             -- e.g. "Beginner Soft Shoe"
  level         text not null
                  check (level in ('beginner','advanced','competitive','adult','ceili')),
  shoe_type     text not null
                  check (shoe_type in ('soft','hard','soft-hard','n/a')),
  age_min       int,
  age_max       int,                        -- null = no upper cap
  is_private    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint classes_time_order check (end_time > start_time)
);

create index classes_season_idx on classes(season_id);
create index classes_location_idx on classes(location_id);

-- Duration in minutes, derived from start/end. Used for rate_card lookups so
-- tuition never depends on a hand-entered duration.
create or replace function public.class_duration_minutes(c classes)
returns int
language sql
immutable
as $$
  select (extract(epoch from (c.end_time - c.start_time)) / 60)::int;
$$;

-- One row per actual calendar occurrence, generated from `classes`.
create table class_sessions (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references classes(id) on delete cascade,
  session_date  date not null,
  start_time    time not null,             -- defaults from class, overridable
  end_time      time not null,             -- defaults from class, overridable
  location_id   uuid not null references locations(id) on delete restrict,
  status        text not null default 'scheduled'
                  check (status in ('scheduled','cancelled','rescheduled')),
  note          text,                       -- e.g. "No class — Thanksgiving"
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (class_id, session_date)
);

create index class_sessions_class_idx on class_sessions(class_id);
create index class_sessions_date_idx on class_sessions(session_date);

-- ===========================================================================
-- 3.2 Accounts & Family
-- ===========================================================================

create table family_accounts (
  id              uuid primary key default gen_random_uuid(),
  -- Links the family account to its Supabase Auth login. Nullable so an admin
  -- can create a family record before an invite is accepted.
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  parent1_name    text not null,
  parent1_phone   text,
  parent1_email   text not null,           -- primary login + primary comms
  parent2_name    text,
  parent2_phone   text,
  parent2_email   text,                     -- not a separate login in v1
  referral_source referral_source,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index family_accounts_auth_idx on family_accounts(auth_user_id);

-- Admin allow-list (Debbie). Kept separate from family_accounts so the admin
-- check is a single-table lookup for RLS.
create table admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table family_members (
  id                             uuid primary key default gen_random_uuid(),
  family_account_id              uuid not null references family_accounts(id) on delete cascade,
  first_name                     text not null,
  last_name                      text not null,
  address                        text,
  birthday                       date,
  gender                         text,
  medical_notes                  text,      -- conditions / meds / allergies
  emergency_contact_name         text,
  emergency_contact_phone        text,
  emergency_contact_relationship text,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

create index family_members_account_idx on family_members(family_account_id);

create table consents (
  id                   uuid primary key default gen_random_uuid(),
  family_member_id     uuid not null references family_members(id) on delete cascade,
  type                 consent_type not null,
  agreed_at            timestamptz not null default now(),
  -- Exact wording agreed to at signing time. Stored, not linked, so a later
  -- policy edit never changes what someone agreed to.
  policy_text_snapshot text not null,
  created_at           timestamptz not null default now()
);

create index consents_member_idx on consents(family_member_id);

create table enrollments (
  id                uuid primary key default gen_random_uuid(),
  family_member_id  uuid not null references family_members(id) on delete cascade,
  class_id          uuid not null references classes(id) on delete restrict,
  status            text not null default 'active'
                      check (status in ('active','paused','removed')),
  enrolled_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index enrollments_member_idx on enrollments(family_member_id);
create index enrollments_class_idx on enrollments(class_id);
-- A dancer can enroll in many classes, but only one live row per (dancer, class).
create unique index enrollments_unique_active
  on enrollments(family_member_id, class_id)
  where status <> 'removed';

-- ===========================================================================
-- 3.3 Rates & Billing
-- ===========================================================================

create table rate_card (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references seasons(id) on delete cascade,
  duration_minutes  int not null,           -- 30 / 60 / 75 / 90 / 120
  price             numeric(10,2) not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (season_id, duration_minutes)
);

create table order_items (
  id                uuid primary key default gen_random_uuid(),
  family_member_id  uuid not null references family_members(id) on delete cascade,
  item_type         text not null,          -- t-shirt / socks / t-shirt+socks / costume rental / other
  amount            numeric(10,2) not null,
  created_at        timestamptz not null default now()
);

create index order_items_member_idx on order_items(family_member_id);

create table payment_plans (
  id                    uuid primary key default gen_random_uuid(),
  family_member_id      uuid not null references family_members(id) on delete cascade,
  plan_type             text not null
                          check (plan_type in ('quarterly','paid_in_full','custom')),
  total_amount          numeric(10,2) not null,
  installment_schedule  jsonb not null default '[]'::jsonb,  -- [{date, amount}, ...]
  helcim_subscription_id text,
  status                text not null default 'active'
                          check (status in ('active','stopped','completed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index payment_plans_member_idx on payment_plans(family_member_id);

create table payments (
  id                      uuid primary key default gen_random_uuid(),
  family_member_id        uuid not null references family_members(id) on delete cascade,
  payment_plan_id         uuid references payment_plans(id) on delete set null,
  amount                  numeric(10,2) not null,
  category                text not null default 'tuition'
                            check (category in ('tuition','costume','add-on','other')),
  paid_at                 timestamptz,
  helcim_transaction_id   text,
  -- Late-fee fields provisioned per spec §3.3; automation is intentionally
  -- NOT wired until Debbie confirms amount + auto/manual policy (Open Items).
  late_fee_amount         numeric(10,2),
  late_fee_applied_at     timestamptz,
  created_at              timestamptz not null default now()
);

create index payments_member_idx on payments(family_member_id);
create index payments_plan_idx on payments(payment_plan_id);
create index payments_paid_at_idx on payments(paid_at);

-- ===========================================================================
-- 3.4 Announcements & Communication
-- ===========================================================================

create table announcements (
  id                uuid primary key default gen_random_uuid(),
  subject           text not null,
  body              text not null,          -- verbatim; source of truth
  sender            text not null default 'debbie@macvoyirishdance.com',
  audience_type     audience_type not null,
  audience_ref      jsonb not null default '{}'::jsonb,  -- location_id | class_id[] | family_member_id[]
  sent_at           timestamptz,
  loops_message_id  text,                   -- for Loops open/click stats
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index announcements_sent_at_idx on announcements(sent_at);

create table announcement_reads (
  id                uuid primary key default gen_random_uuid(),
  announcement_id   uuid not null references announcements(id) on delete cascade,
  family_account_id uuid not null references family_accounts(id) on delete cascade,
  read_at           timestamptz not null default now(),
  unique (announcement_id, family_account_id)
);

create index announcement_reads_account_idx on announcement_reads(family_account_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger trg_locations_updated       before update on locations       for each row execute function public.set_updated_at();
create trigger trg_seasons_updated         before update on seasons         for each row execute function public.set_updated_at();
create trigger trg_classes_updated         before update on classes         for each row execute function public.set_updated_at();
create trigger trg_class_sessions_updated  before update on class_sessions  for each row execute function public.set_updated_at();
create trigger trg_family_accounts_updated before update on family_accounts for each row execute function public.set_updated_at();
create trigger trg_family_members_updated  before update on family_members  for each row execute function public.set_updated_at();
create trigger trg_enrollments_updated     before update on enrollments     for each row execute function public.set_updated_at();
create trigger trg_rate_card_updated       before update on rate_card       for each row execute function public.set_updated_at();
create trigger trg_payment_plans_updated   before update on payment_plans   for each row execute function public.set_updated_at();
create trigger trg_announcements_updated   before update on announcements   for each row execute function public.set_updated_at();
