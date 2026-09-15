-- ===========================================================================
-- PROPOSED cleanup of automated ("bot") signups.  NOT YET RUN.
--
--   Nick: read the two warnings below, run STEP 1, eyeball the list, and only
--   then run STEP 2.  Deletion cascades and cannot be undone.
--
-- Written 2026-09-15 against project xvdyfrlgrhebiiymvddd.
-- ===========================================================================
--
-- WARNING 1 — do NOT select rows by "has no dancers attached".
--   That was the obvious-looking rule and it is wrong.  Seven accounts with no
--   family_members are legitimate, including Debbie's own (ddmac@rogers.com),
--   two real parents (Diana Chadha, Lylia Singh) and four of your test logins.
--   Using that rule would have deleted all of them.
--
-- WARNING 2 — "has a dancer" no longer proves an account is real.
--   The signup at 2026-09-15 20:20 (c.o.ll.e.e.ncolom.bo@gmail.com) completed
--   a full registration: 1 dancer, 10 class enrolments, 6 consents.  Those
--   enrolments are sitting on real class rosters right now.
--
-- The discriminator that actually holds is the parent name being a random
-- mixed-case string, combined with never having signed in.  Of 43 accounts,
-- 18 match; none of those 18 has ever signed in, and none has any payment
-- history.  The same test is enforced going forward in src/lib/formGuard.ts.
--
-- There is no foreign key from family_accounts.auth_user_id to auth.users, so
-- the two deletes are independent and both are needed.  Deleting a
-- family_account DOES cascade to family_members, and from there to consents,
-- enrollments, order_items, payment_intents, payment_plans and payments —
-- which is exactly why the "no payments" guard below is not optional.
-- ---------------------------------------------------------------------------

-- Shared definition of "looks automated".  Kept in one place so STEP 1 and
-- STEP 2 can never drift apart.
create or replace view public._bot_signup_candidates as
  select fa.id as family_account_id,
         fa.auth_user_id,
         fa.parent1_name,
         fa.parent1_email,
         fa.created_at
  from public.family_accounts fa
  left join auth.users u on u.id = fa.auth_user_id
  where fa.parent1_name !~ '\s'                    -- no space anywhere
    and length(fa.parent1_name) >= 15              -- and implausibly long
    and fa.parent1_name ~ '[a-z][A-Z]'             -- and camelCase noise
    and u.last_sign_in_at is null                  -- never once signed in
    and not exists (select 1 from public.admins a
                     where a.user_id = fa.auth_user_id)
    and not exists (select 1 from public.payments p
                    join public.family_members fm on fm.id = p.family_member_id
                    where fm.family_account_id = fa.id)
    and not exists (select 1 from public.payment_intents pi
                    join public.family_members fm on fm.id = pi.family_member_id
                    where fm.family_account_id = fa.id);

-- ---------------------------------------------------------------------------
-- STEP 1 — REVIEW.  Read-only.  Run this and check every row before going on.
-- Expect 18 rows, all with obviously random parent1_name values.
-- If ANY row looks like a real family, stop and re-tighten the view above.
-- ---------------------------------------------------------------------------
select c.parent1_name,
       c.parent1_email,
       c.created_at,
       (select count(*) from public.family_members fm
         where fm.family_account_id = c.family_account_id) as dancers_to_delete,
       (select count(*) from public.enrollments e
        join public.family_members fm on fm.id = e.family_member_id
        where fm.family_account_id = c.family_account_id) as enrolments_to_delete
from public._bot_signup_candidates c
order by c.created_at;

-- ---------------------------------------------------------------------------
-- STEP 2 — DELETE.  Only after STEP 1 looks right.
--
-- Wrapped in a transaction with the expected row count asserted, so a view
-- that has quietly started matching more than it should aborts instead of
-- deleting.  Adjust 18 if STEP 1 legitimately returned a different number.
-- ---------------------------------------------------------------------------
begin;

-- Materialise the ids FIRST.  The view reads from family_accounts, so once the
-- first delete runs it returns nothing — driving the auth.users delete straight
-- off it would silently leave every orphaned login behind.
create temp table _bot_ids on commit drop as
  select family_account_id, auth_user_id from public._bot_signup_candidates;

do $$
declare
  n int;
begin
  select count(*) into n from _bot_ids;
  if n <> 18 then
    raise exception
      'Expected 18 bot accounts, found %. Re-run STEP 1 and review before deleting.', n;
  end if;
end $$;

-- Cascades to family_members -> consents, enrollments, order_items,
-- payment_intents, payment_plans, payments.
delete from public.family_accounts
 where id in (select family_account_id from _bot_ids);

-- No FK ties these to family_accounts, so remove them separately.
delete from auth.users
 where id in (select auth_user_id from _bot_ids where auth_user_id is not null);

commit;

-- ---------------------------------------------------------------------------
-- STEP 3 — tidy up.
-- ---------------------------------------------------------------------------
drop view if exists public._bot_signup_candidates;

-- Sanity check afterwards: should return 0.
-- select count(*) from public.family_accounts fa
--  where fa.parent1_name !~ '\s' and length(fa.parent1_name) >= 15
--    and fa.parent1_name ~ '[a-z][A-Z]';
