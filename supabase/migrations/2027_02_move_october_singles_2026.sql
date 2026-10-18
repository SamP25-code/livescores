-- 2027 multi-competition site - part 2: move the October Singles 2026 across
-- See docs/database-design.md ("Moving the October Singles 2026"). Run AFTER part 1.
-- Run on the TEST project first (with a copy of the 2026 data), then on live.
--
-- Turns the existing five nights and their players into:
--   Penwortham (club) -> October Singles (series) -> October Singles 2026 (competition)
--   one person + one entry per player, each night's player rows pointing at the entries.
-- Matches, scores, score history and the viewer log don't move.
--
-- BEFORE RUNNING:
--   1. Run the CHECK query below on its own and look for the same person spelled two
--      ways (e.g. "Dave Jackson" / "David Jackson"). Fix any in the Table Editor first,
--      or they'll become two people (they can be merged later, but it's easier now).
--   2. Replace YOUR-EMAIL@EXAMPLE.COM at the bottom with your login email for THIS project.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.
--
-- ---------------------------------------------------------------------------
-- CHECKS TO RUN AFTERWARDS (each on its own) - all should look right before using the new pages
-- ---------------------------------------------------------------------------
-- Every night belongs to the competition, with dates (expect 5 rows, none empty):
-- select name, session_number, date, start_time, competition_id is not null as linked
-- from nights order by session_number;
--
-- Every player row has an entry (expect 0):
-- select count(*) as rows_without_entry from players where entry_id is null;
--
-- People and entries (expect the same number - one entry each):
-- select (select count(*) from people) as people, (select count(*) from entries) as entries;
--
-- You're Super (expect your email):
-- select email from auth.users where raw_app_meta_data ->> 'role' = 'super';

-- ---------------------------------------------------------------------------
-- CHECK (run on its own first): every distinct player name, and how many rows use it
-- ---------------------------------------------------------------------------
-- select btrim(name) as name, count(*) as rows
-- from players
-- group by btrim(name)
-- order by lower(btrim(name));

begin;

-- 1. The club, the venue, the series and the 2026 competition
with org as (
  insert into organisers (name, short_name, kind)
  values ('Penwortham Sports & Social Club', 'Penwortham', 'club')
  returning id
),
ven as (
  insert into venues (name)                      -- add the address and postcode later
  values ('Penwortham Sports & Social Club')
  returning id
),
ser as (
  insert into series (organiser_id, name, slug)
  select id, 'October Singles', 'october-singles' from org
  returning id
)
insert into competitions (
  series_id, year, status, format, team_size, entry_method, target_score, scoring_style,
  draw_size, qualifying_nights, entries_per_night, qualifiers_per_night, draw_method,
  structure_locked, sponsor_name, sponsor_url, venue_id
)
select ser.id, 2026, 'archived', 'qualifying_and_finals', 1, 'open', 21, 'live',
       16, 4, 16, 4, 'in_advance',
       true, 'Verve Wills & Estate Planning', 'https://vervewills.co.uk/', ven.id
from ser, ven;

-- 2. Point the five nights at it, with their dates and start times
update nights n
set competition_id = c.id,
    session_number = v.session_number,
    date = v.date,
    start_time = v.start_time
from competitions c
join series s on s.id = c.series_id and s.slug = 'october-singles' and c.year = 2026,
(values
  ('Monday 12th October',                 1, date '2026-10-12', time '19:00'),
  ('Tuesday 13th October',                2, date '2026-10-13', time '19:00'),
  ('Wednesday 14th October',              3, date '2026-10-14', time '19:00'),
  ('Thursday 15th October',               4, date '2026-10-15', time '19:00'),
  ('Finals Day - Saturday 17th October',  5, date '2026-10-17', time '13:00')
) as v(name, session_number, date, start_time)
where n.name = v.name;

-- 3. One person per distinct player name (first spelling seen is kept)
insert into people (full_name)
select distinct on (lower(btrim(name))) btrim(name)
from players
where name is not null and btrim(name) <> ''
order by lower(btrim(name)), created_at;

-- 4. One entry per person in the 2026 competition
insert into entries (competition_id, person_id)
select c.id, p.id
from people p, competitions c
join series s on s.id = c.series_id and s.slug = 'october-singles' and c.year = 2026;

-- 5. Each night's player rows point at their entry (Finals Day rows share the
--    entries of the qualifying rows they came from, as they have the same name)
update players pl
set entry_id = e.id
from entries e
join people p on p.id = e.person_id
where lower(btrim(pl.name)) = lower(p.full_name);

-- 6. Finished matches get a "finished at" time (their last update)
update matches set completed_at = updated_at
where status = 'complete' and completed_at is null;

-- 7. Your login becomes Super (takes effect the next time you sign in)
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "super"}'::jsonb
where email = 'YOUR-EMAIL@EXAMPLE.COM';

commit;
