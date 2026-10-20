-- TEST DATABASE ONLY (bowls-live-test).
--
-- Removes the Blackpool Masters set-up so it can be done again from scratch:
-- the event (club/event entry), its competition names, competitions,
-- sessions, entries, draws, sponsors, assignments, qualifying places and
-- qualifying competitions, and its posts. Venues (e.g. Marton Institute),
-- people and logins are kept. Uploaded pictures stay in Storage
-- (sponsor-logos / event-images) - delete them there if you like.
--
-- STEP 1 - run this on its own first. It lists what matches "Blackpool"; it
-- should be just the Blackpool Masters and its competitions:
--
--   select o.name as run_by, o.kind, s.name as competition, c.year
--   from organisers o
--   left join series s on s.organiser_id = o.id
--   left join competitions c on c.series_id = s.id
--   where o.name ilike '%blackpool%' or o.short_name ilike '%blackpool%'
--   order by o.name, s.name, c.year;
--
-- STEP 2 - run everything below. The last result lists anything left that
-- matches "Blackpool" - it should be empty.

begin;

create temp table bm_orgs on commit drop as
select id from organisers where name ilike '%blackpool%' or short_name ilike '%blackpool%';

create temp table bm_comps on commit drop as
select c.id from competitions c join series s on s.id = c.series_id where s.organiser_id in (select id from bm_orgs);

-- Guard: stop if it would touch anything else that looks real
do $$
begin
  if (select count(*) from bm_orgs) = 0 then
    raise exception 'Nothing called Blackpool found - nothing removed.';
  end if;
  if (select count(*) from bm_orgs) > 2 then
    raise exception 'More than two clubs/events match "Blackpool" - check step 1 first. Nothing removed.';
  end if;
end $$;

-- Other competitions' qualifying places that point at these competitions
delete from qualifying_places where source_competition_id in (select id from bm_comps);
update qualifier_events set source_competition_id = null where source_competition_id in (select id from bm_comps);

-- The competitions (their sessions, draws, entries, sponsors, assignments,
-- change logs, qualifying places and qualifying competitions go with them)
delete from competitions where id in (select id from bm_comps);

-- Their competition names, then the event itself (its posts go with it)
delete from series where organiser_id in (select id from bm_orgs);
update people set club_id = null where club_id in (select id from bm_orgs);
delete from organisers where id in (select id from bm_orgs);

commit;

select o.name, o.kind from organisers o where o.name ilike '%blackpool%' or o.short_name ilike '%blackpool%';
