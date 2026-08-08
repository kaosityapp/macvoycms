-- ===========================================================================
-- Class-session generation (spec §3.1 "Generation & editing logic")
--
-- Walks each class's day_of_week across the season date range and inserts one
-- class_sessions row per occurrence. Idempotent via the (class_id,
-- session_date) unique constraint, so it is safe to re-run.
--
-- `p_from` supports the spec's future-only regeneration: pass a date to only
-- (re)generate occurrences on/after it, leaving past sessions untouched. The
-- admin "edit template, apply from date onward" flow calls this with p_from.
-- ===========================================================================

create or replace function public.generate_class_sessions(
  p_season_id uuid,
  p_from date default null
)
returns int
language plpgsql
as $$
declare
  v_season  seasons;
  v_class   classes;
  v_date    date;
  v_start   date;
  v_dow     int;
  v_count   int := 0;
begin
  select * into v_season from seasons where id = p_season_id;
  if v_season.id is null then
    raise exception 'Season % not found', p_season_id;
  end if;

  v_start := greatest(v_season.start_date, coalesce(p_from, v_season.start_date));

  for v_class in select * from classes where season_id = p_season_id loop
    v_dow := case v_class.day_of_week
      when 'Sunday' then 0
      when 'Monday' then 1
      when 'Tuesday' then 2
      when 'Wednesday' then 3
      when 'Thursday' then 4
      when 'Friday' then 5
      when 'Saturday' then 6
    end;

    v_date := v_start;
    while v_date <= v_season.end_date loop
      if extract(dow from v_date)::int = v_dow then
        insert into class_sessions
          (class_id, session_date, start_time, end_time, location_id, status)
        values
          (v_class.id, v_date, v_class.start_time, v_class.end_time, v_class.location_id, 'scheduled')
        on conflict (class_id, session_date) do nothing;
        v_count := v_count + 1;
      end if;
      v_date := v_date + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

-- Admin/CLI-only: never callable by parents via PostgREST RPC. Revoke the
-- default PUBLIC grant (which would otherwise reach anon/authenticated) and
-- allow only the service role. Admin actions invoke this via the service-role
-- client; the migration/CLI runs as the owner.
revoke execute on function public.generate_class_sessions(uuid, date) from public;
grant execute on function public.generate_class_sessions(uuid, date) to service_role;

-- Generate the full 2026–2027 season now so the calendar has data after a
-- `supabase db reset`. (Admin will re-run/regenerate as templates change.)
select public.generate_class_sessions((select id from seasons where name = '2026–2027'));
