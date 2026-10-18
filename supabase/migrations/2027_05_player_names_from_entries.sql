-- 2027 multi-competition site - part 5: names in a draw come from the entry
-- Run AFTER parts 1 to 4, on the TEST project first.
--
-- A place in a session's draw (a players row) points at an entry. Its name is
-- now filled in by the database from that entry's people, and kept up to date:
--   - a pair shows as "Wayne Ditchfield & Lee Hanson"
--   - if two different people with the same name are in the same competition,
--     each gets their note or club: "John Smith (Jnr)", "John Smith (Penwortham)"
--   - someone hidden for privacy shows as "Withdrawn player"
-- Changing an entry, correcting a person's name, or merging two people updates
-- every draw they're in straight away - including the live pages.
--
-- The name is still stored on each place (rather than looked up every time) so
-- the live pages, which are sent single rows as they change, always have it.
-- Places with no entry (anything typed in before 2027) keep their typed name.
--
-- At the end it lists any name that changed. For the 2026 October Singles that
-- list should be empty - the names come out the same as they were typed.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

-- The name shown for one entry
create or replace function entry_display_name(eid uuid) returns text
language sql stable security definer set search_path = public as $$
  with e as (
    select * from entries where id = eid
  ),
  members as (
    select x.pos, p.id, p.full_name, p.hidden,
           coalesce(nullif(btrim(p.note), ''), o.short_name) as detail
    from e
    cross join lateral (values (1, e.person_id), (2, e.partner_id)) as x(pos, pid)
    join people p on p.id = x.pid
    left join organisers o on o.id = p.club_id
  ),
  -- Everyone in the same competition, to spot two people sharing a name
  competitors as (
    select p.id, lower(btrim(p.full_name)) as n
    from entries e2
    join e on e2.competition_id = e.competition_id
    cross join lateral (values (e2.person_id), (e2.partner_id)) as y(pid)
    join people p on p.id = y.pid
  )
  select string_agg(
    case
      when m.hidden then 'Withdrawn player'
      when m.detail is not null and exists (
        select 1 from competitors c where c.n = lower(btrim(m.full_name)) and c.id <> m.id
      ) then m.full_name || ' (' || m.detail || ')'
      else m.full_name
    end,
    ' & ' order by m.pos)
  from members m;
$$;

-- A place's name always follows its entry, whatever is written to it
create or replace function players_take_entry_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.entry_id is not null then
    new.name := entry_display_name(new.entry_id);
  end if;
  return new;
end;
$$;

create trigger players_entry_name
before insert or update of entry_id, name on players
for each row execute function players_take_entry_name();

-- Brings every place in one competition up to date (only rows that change, so
-- the live pages aren't sent updates for nothing)
create or replace function refresh_competition_names(comp uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update players pl
  set name = entry_display_name(pl.entry_id)
  from entries e
  where e.id = pl.entry_id
    and e.competition_id = comp
    and pl.name is distinct from entry_display_name(pl.entry_id);
end;
$$;

-- An entry added, changed, withdrawn or removed - it may also bring in (or take
-- away) a second person with the same name, so the whole competition is checked
create or replace function entries_refresh_names() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform refresh_competition_names(old.competition_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.competition_id <> old.competition_id) then
    perform refresh_competition_names(new.competition_id);
  end if;
  return null;
end;
$$;

create trigger entries_names
after insert or update or delete on entries
for each row execute function entries_refresh_names();

-- A person's name, note, club or privacy changed - update every competition
-- they're entered in
create or replace function people_refresh_names() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  comp uuid;
begin
  for comp in
    select distinct competition_id from entries where person_id = new.id or partner_id = new.id
  loop
    perform refresh_competition_names(comp);
  end loop;
  return null;
end;
$$;

create trigger people_names
after update of full_name, note, club_id, hidden on people
for each row execute function people_refresh_names();

-- Note what's about to change, then bring every competition up to date
create temp table name_changes as
select pl.id, pl.name as old_name, entry_display_name(pl.entry_id) as new_name
from players pl
where pl.entry_id is not null
  and pl.name is distinct from entry_display_name(pl.entry_id);

select refresh_competition_names(id) from competitions;

commit;

select old_name, new_name from name_changes order by old_name;
