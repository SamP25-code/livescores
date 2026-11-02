-- GO-LIVE ONLY: run on the TEST project (bowls-live-test) on the day it
-- becomes the live database. See docs/go-live-checklist.md, section 3.
--
-- Clears what winter testing left on the real competitions, and keeps all
-- their set-up:
--   cleared - draws, scores and viewer counts for sessions not yet played
--             (dated today or later, or with no date), results typed into
--             qualifying competitions whose final is still to come, and the
--             change log of competitions that aren't finished
--   kept    - clubs, events, the county, competitions and settings, sessions
--             (dates, times, venues, start times), sponsors and logos,
--             backgrounds, people, entries, past winners, qualifying places,
--             posts, admins and scorers, and everything already played
--             (the October Singles 2026)
--
-- Logins aren't touched: remove test ones on the Users page.
--
-- STEP 1 - run this on its own first. It lists each session that will be
-- cleared, with how much is on it. Postponed ones are marked - if a
-- postponement was only a test, undo it on the session page first.
--
--   select s.name as competition, c.year, n.session_number, n.kind, n.date,
--          n.postponed,
--          (select count(*) from players p where p.night_id = n.id) as draw_places,
--          (select count(*) from matches m where m.night_id = n.id and m.status <> 'upcoming') as scored
--   from nights n
--   join competitions c on c.id = n.competition_id
--   join series s on s.id = c.series_id
--   where c.status <> 'archived' and (n.date is null or n.date >= current_date)
--   order by n.date nulls last, s.name, n.session_number;
--
-- STEP 2 - REHEARSAL. Run everything below as it is. It does the whole tidy,
-- shows what's left, then puts everything back (the last line is rollback).
--
-- STEP 3 - FOR REAL. Change the last line from rollback to commit, run it
-- again, and check the results match the rehearsal.

begin;

-- Guard: stop if this isn't the database with the 2027 competitions on it
do $$
begin
  if not exists (
    select 1 from competitions c join series s on s.id = c.series_id
    where s.slug = 'october-singles' and c.year = 2026
  ) then
    raise exception 'October Singles 2026 not found - is this the right database? Nothing changed.';
  end if;
  if not exists (select 1 from competitions where year >= 2027) then
    raise exception 'No 2027 competitions here - is this the right database? Nothing changed.';
  end if;
end $$;

create temp table unplayed on commit drop as
select n.id
from nights n
join competitions c on c.id = n.competition_id
where c.status <> 'archived' and (n.date is null or n.date >= current_date);

-- Scores (their history goes with them), then the draw places
delete from matches where night_id in (select id from unplayed);
delete from players where night_id in (select id from unplayed);
delete from viewer_pings where night_id in (select id from unplayed);
update nights set status = 'upcoming' where id in (select id from unplayed);

-- Results typed into qualifying competitions not yet played
delete from qualifier_matches
where qualifier_event_id in (
  select q.id from qualifier_events q where q.final_date is null or q.final_date >= current_date
);

-- The change log of competitions still to come (practice draws, test scores)
delete from audit_log
where competition_id in (select id from competitions where status <> 'archived');

-- What's left, to compare with the rehearsal
select s.name as competition, c.year, c.status,
       (select count(*) from nights n where n.competition_id = c.id) as sessions,
       (select count(*) from entries e where e.competition_id = c.id and e.status = 'entered') as entered,
       (select count(*) from players p join nights n on n.id = p.night_id where n.competition_id = c.id) as draw_places,
       (select count(*) from matches m join nights n on n.id = m.night_id where n.competition_id = c.id and m.status = 'complete') as results
from competitions c
join series s on s.id = c.series_id
order by c.year, s.name;

rollback;
