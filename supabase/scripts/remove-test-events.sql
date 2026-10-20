-- TEST DATABASE ONLY (bowls-live-test).
--
-- Removes every EVENT (Blackpool Masters, Challenge Night, Ladies 32 - any
-- club/event entry marked as an event) so they can be set up again: their
-- competition names, competitions, sessions, entries, draws, sponsors,
-- assignments, qualifying places and qualifying competitions, and posts.
-- Clubs and their competitions (Penwortham, Floodlit Singles, the October
-- Singles 2026...), venues, people and logins are kept. Uploaded pictures
-- stay in Storage (sponsor-logos / event-images).
--
-- STEP 1 - run this on its own first. It lists the events and their
-- competitions - it should be just the three you made:
--
--   select o.name as event, s.name as competition, c.year
--   from organisers o
--   left join series s on s.organiser_id = o.id
--   left join competitions c on c.series_id = s.id
--   where o.kind = 'event'
--   order by o.name, s.name, c.year;
--
-- STEP 2 - run everything below. The last result lists any events left - it
-- should be empty.

begin;

create temp table ev_orgs on commit drop as
select id from organisers where kind = 'event';

create temp table ev_comps on commit drop as
select c.id from competitions c join series s on s.id = c.series_id where s.organiser_id in (select id from ev_orgs);

-- Guard: the October Singles 2026 must not be caught up in this
do $$
begin
  if exists (
    select 1 from competitions c join series s on s.id = c.series_id
    where c.id in (select id from ev_comps) and s.slug = 'october-singles'
  ) then
    raise exception 'The October Singles is listed under an event - check step 1. Nothing removed.';
  end if;
  if (select count(*) from ev_orgs) > 5 then
    raise exception 'More than five events found - check step 1. Nothing removed.';
  end if;
end $$;

-- Other competitions' qualifying places that point at these competitions
delete from qualifying_places where source_competition_id in (select id from ev_comps);
update qualifier_events set source_competition_id = null where source_competition_id in (select id from ev_comps);

-- The competitions (sessions, draws, entries, sponsors, assignments, change
-- logs, qualifying places and qualifying competitions go with them)
delete from competitions where id in (select id from ev_comps);

-- Their competition names, then the events themselves (posts go with them)
delete from series where organiser_id in (select id from ev_orgs);
update people set club_id = null where club_id in (select id from ev_orgs);
delete from organisers where id in (select id from ev_orgs);

commit;

select name from organisers where kind = 'event';
