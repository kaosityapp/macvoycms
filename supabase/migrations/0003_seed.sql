-- ===========================================================================
-- Seed data — 2026–2027 season
-- Ref: MacVoy_Platform_Spec.md §3.1 seed table + §3.3 rate card seed
--
-- NOTE: season start/end dates below are PLACEHOLDERS for Debbie to confirm in
-- admin before sessions are generated. Everything else matches the spec.
-- ===========================================================================

insert into locations (name, address) values
  ('Pickering', null),
  ('Mississauga', null);

insert into seasons (name, start_date, end_date) values
  ('2026–2027', date '2026-09-08', date '2027-06-30');

-- Rate card (seed): $12 / $22 / $27 / $32 / $42 for 30 / 60 / 75 / 90 / 120 min
insert into rate_card (season_id, duration_minutes, price)
select s.id, v.duration_minutes, v.price
from (values
  (30,  12.00),
  (60,  22.00),
  (75,  27.00),
  (90,  32.00),
  (120, 42.00)
) as v(duration_minutes, price)
cross join (select id from seasons where name = '2026–2027') s;

-- Classes. loc | day | start | end | name | level | shoe_type | age_min | age_max
insert into classes
  (season_id, location_id, day_of_week, start_time, end_time, name, level, shoe_type, age_min, age_max, is_private)
select s.id, l.id, v.day_of_week, v.start_time::time, v.end_time::time,
       v.name, v.level, v.shoe_type, v.age_min::int, v.age_max::int, false
from (values
  -- Monday — Pickering
  ('Pickering',  'Monday',   '17:30', '18:00', 'Beginner Soft Shoe',                'beginner',    'soft',      3,    6),
  ('Pickering',  'Monday',   '18:00', '19:30', 'Competitive Soft/Hard Shoe',        'competitive', 'soft-hard', null, null),
  ('Pickering',  'Monday',   '19:30', '21:00', 'Adult Competitive Soft/Hard Shoe',  'adult',       'soft-hard', 18,   null),
  ('Pickering',  'Monday',   '21:00', '22:00', 'Competitive Ceili Teams',           'ceili',       'n/a',       null, null),
  -- Tuesday — Mississauga
  ('Mississauga','Tuesday',  '17:30', '18:00', 'Beginner 1 Soft Shoe',              'beginner',    'soft',      3,    6),
  ('Mississauga','Tuesday',  '18:00', '18:45', 'Beginner Soft Shoe',                'beginner',    'soft',      6,    null),
  ('Mississauga','Tuesday',  '18:45', '19:15', 'Beginner Hard Shoe',                'beginner',    'hard',      6,    null),
  ('Mississauga','Tuesday',  '19:00', '20:00', 'Advanced Soft Shoe',                'advanced',    'soft',      9,    null),
  ('Mississauga','Tuesday',  '20:00', '21:00', 'Advanced Hard Shoe',                'advanced',    'hard',      9,    null),
  ('Mississauga','Tuesday',  '21:00', '22:00', 'Adult Soft/Hard Shoe',              'adult',       'soft-hard', 18,   null),
  -- Thursday — Pickering
  ('Pickering',  'Thursday', '17:30', '18:15', 'Beginner Soft Shoe',                'beginner',    'soft',      6,    null),
  ('Pickering',  'Thursday', '18:15', '18:45', 'Beginner Hard Shoe',                'beginner',    'hard',      6,    null),
  ('Pickering',  'Thursday', '18:45', '20:45', 'Competitive Soft/Hard Shoe',        'competitive', 'soft-hard', null, null),
  ('Pickering',  'Thursday', '20:45', '22:00', 'Adult Soft/Hard Shoe',              'adult',       'soft-hard', 18,   null)
) as v(loc, day_of_week, start_time, end_time, name, level, shoe_type, age_min, age_max)
join locations l on l.name = v.loc
cross join (select id from seasons where name = '2026–2027') s;

-- ---------------------------------------------------------------------------
-- ⚠ Data flags surfaced from the seed (confirm with Debbie, non-blocking):
--   1. Tue 19:00–20:00 Advanced Soft Shoe overlaps 18:45–19:15 Beginner Hard
--      Shoe and 20:00–21:00 Advanced Hard Shoe (spec §3.1 note).
--   2. Two 45-minute classes — Tue 18:00–18:45 Beginner Soft Shoe and
--      Thu 17:30–18:15 Beginner Soft Shoe — have NO matching rate_card row
--      (card has 30/60/75/90/120 only). Tuition lookup by duration will miss
--      these until either a 45-min rate is added or the times are adjusted.
-- ---------------------------------------------------------------------------
