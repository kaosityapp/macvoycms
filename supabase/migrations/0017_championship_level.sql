-- Add 'championship' as a recognized class level (distinct tier above
-- 'advanced' per Debbie's schedule update — Mississauga's old Advanced
-- Soft Shoe becomes Championship Soft/Hard Shoe).
alter table classes drop constraint classes_level_check;
alter table classes add constraint classes_level_check
  check (level in ('beginner', 'advanced', 'competitive', 'adult', 'ceili', 'championship'));
