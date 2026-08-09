-- ===========================================================================
-- Per-class scheduling + hourly pricing.
-- Each class now carries its own date range, an hourly rate, and a session
-- count. Tuition = hourly_rate × (duration ÷ 60) × total_sessions. This
-- supersedes the season-wide rate_card model (rate_card is left in place but
-- no longer drives tuition).
-- ===========================================================================

alter table classes
  add column if not exists start_date    date,
  add column if not exists end_date      date,
  add column if not exists hourly_rate   numeric(10,2),
  add column if not exists total_sessions int;

-- Backfill existing classes: date range from their season.
update classes c
set start_date = s.start_date, end_date = s.end_date
from seasons s
where s.id = c.season_id and c.start_date is null;

-- Backfill total_sessions from existing (non-cancelled) generated sessions.
update classes c
set total_sessions = (
  select count(*) from class_sessions cs
  where cs.class_id = c.id and cs.status <> 'cancelled'
)
where c.total_sessions is null;
