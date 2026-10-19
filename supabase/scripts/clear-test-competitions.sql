-- TEST DATABASE ONLY (bowls-live-test). Never run this on the live project.
--
-- Removes every competition except the October Singles 2026 (the real 2026
-- results copied from live), so the real 2027 competitions can be added again
-- cleanly. Goes with them: their sessions, draws, scores, entries, start
-- times, sponsors, assignments and change logs. Then tidies up anything left
-- that nothing uses: competition names (series), clubs and events, venues,
-- and people who aren't entered in anything.
--
-- Not touched: logins (remove test ones on the Users page if you like),
-- the October Singles 2026 and its players, and uploaded logo files (remove
-- them in Supabase: Storage -> sponsor-logos).
--
-- STEP 1 - run this on its own first to see what will be removed:
--
--   select s.name, c.year, c.status
--   from competitions c join series s on s.id = c.series_id
--   where not (s.slug = 'october-singles' and c.year = 2026)
--   order by s.name, c.year;
--
-- STEP 2 - run everything below. The last result lists what's left (it should
-- be just the October Singles 2026).

begin;

create temp table doomed on commit drop as
select c.id
from competitions c
join series s on s.id = c.series_id
where not (s.slug = 'october-singles' and c.year = 2026);

-- Guard: stop if the October Singles 2026 isn't here (the wrong database?)
do $$
begin
  if not exists (
    select 1 from competitions c join series s on s.id = c.series_id
    where s.slug = 'october-singles' and c.year = 2026
  ) then
    raise exception 'October Singles 2026 not found - is this the test database? Nothing removed.';
  end if;
end $$;

-- Sessions first (their places, matches, scores, start times and viewer
-- counts go with them), then the competitions (entries, sponsors,
-- assignments, change logs and qualifying places go with those)
delete from qualifying_places where source_competition_id in (select id from doomed);
delete from nights where competition_id in (select id from doomed);
delete from competitions where id in (select id from doomed);

-- Competition names with no competitions left (and any honours added to them)
delete from series s where not exists (select 1 from competitions c where c.series_id = s.id);

-- Venues nothing uses
delete from venues v
where not exists (select 1 from competitions c where c.venue_id = v.id)
  and not exists (select 1 from nights n where n.venue_id = v.id);

-- People not entered in anything: merged-away records first, then the rest
delete from people p
where p.merged_into_id is not null
  and not exists (select 1 from entries e where e.person_id = p.id or e.partner_id = p.id)
  and not exists (select 1 from honours_history h where h.winner_person_id = p.id or h.runner_up_person_id = p.id);
delete from people p
where not exists (select 1 from entries e where e.person_id = p.id or e.partner_id = p.id)
  and not exists (select 1 from honours_history h where h.winner_person_id = p.id or h.runner_up_person_id = p.id)
  and not exists (select 1 from people q where q.merged_into_id = p.id);

-- Clubs and events nothing uses
delete from organisers o
where not exists (select 1 from series s where s.organiser_id = o.id)
  and not exists (select 1 from people p where p.club_id = o.id);

commit;

select s.name, c.year, c.status,
       (select count(*) from nights n where n.competition_id = c.id) as sessions,
       (select count(*) from entries e where e.competition_id = c.id) as entries
from competitions c join series s on s.id = c.series_id
order by s.name, c.year;
