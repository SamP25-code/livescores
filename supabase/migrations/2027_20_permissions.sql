-- 2027 multi-competition site - part 20: tightening who can change what
-- Run AFTER parts 1 to 19, on the TEST project first.
--
-- From the permissions review (2026-10-29). Nobody without a login can change
-- anything, and set-up stays with Super; these close the gaps between
-- competitions and roles:
--   1. Last 16 results can be saved (stage 4)
--   2. Old "any logged-in user can write" rules removed, if still there
--   3. A scorer changes scores and results only - not who plays whom
--   4. Match history can only be added to a match in that same session
--   5. An admin can't put their entries in another competition's session,
--      or another competition's entry in their draw
--   6. An admin can't rename someone on another competition's honours board
--      or qualifying results
--   7. Hidden people are seen by Super and by admins of competitions they're
--      entered in - not by every admin
--   8. Only Super can add someone already hidden or merged
--   9. The change log's time is always the real time
--  10. A draw isn't readable until it's published (except by its scorers)
--  11. Two internal name functions can't be called from outside
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

-- 1. Last 16 --------------------------------------------------------------------
alter table qualifier_matches drop constraint if exists qualifier_matches_stage_check;
alter table qualifier_matches add constraint qualifier_matches_stage_check check (stage between 1 and 4);

-- 2. Rules from the very first version (only ever dropped by hand) ---------------
drop policy if exists "auth write nights" on nights;
drop policy if exists "auth write players" on players;
drop policy if exists "auth write matches" on matches;
drop policy if exists "auth write match_events" on match_events;
drop policy if exists "public insert viewer_pings" on viewer_pings;

-- 3. Scorers: scores and results only --------------------------------------------
-- A scorer can still put a winner through to their next match (that's how
-- scoring works), but only the player who actually won the match before it.
create or replace function matches_scorer_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- The SQL Editor and admins of the competition: anything
  if auth.uid() is null or can_admin(night_competition(old.night_id)) then
    return new;
  end if;
  if (new.night_id, new.round, new.slot, new.next_match_id, new.next_match_slot, new.target_score, new.start_at)
     is distinct from
     (old.night_id, old.round, old.slot, old.next_match_id, old.next_match_slot, old.target_score, old.start_at) then
    raise exception 'Scorers can only change scores and results';
  end if;
  if (new.player_a_id is distinct from old.player_a_id and new.player_a_id is not null and not exists (
        select 1 from matches f where f.next_match_id = new.id and f.next_match_slot = 'a' and f.winner_id = new.player_a_id))
     or (new.player_b_id is distinct from old.player_b_id and new.player_b_id is not null and not exists (
        select 1 from matches f where f.next_match_id = new.id and f.next_match_slot = 'b' and f.winner_id = new.player_b_id)) then
    raise exception 'Players only go through to a match by winning the one before';
  end if;
  if new.winner_id is not null and new.winner_id is distinct from new.player_a_id and new.winner_id is distinct from new.player_b_id then
    raise exception 'The winner must be one of the two players';
  end if;
  return new;
end;
$$;

drop trigger if exists matches_scorer_guard on matches;
create trigger matches_scorer_guard
before update on matches
for each row execute function matches_scorer_guard();

-- 4. Match history belongs to a match in the same session ------------------------
drop policy if exists "scorers add match_events" on match_events;
create policy "scorers add match_events" on match_events for insert
  with check (
    can_score(night_competition(night_id))
    and exists (
      select 1 from matches m join nights n on n.id = m.night_id
      where m.id = match_events.match_id and m.night_id = match_events.night_id and n.draw_published
    )
  );
drop policy if exists "admins write match_events" on match_events;
create policy "admins write match_events" on match_events for all
  using (can_admin(night_competition(night_id)))
  with check (
    can_admin(night_competition(night_id))
    and exists (select 1 from matches m where m.id = match_events.match_id and m.night_id = match_events.night_id)
  );

-- 5. Entries and draw places stay inside their own competition -------------------
create or replace function entries_session_same_comp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.session_id is not null and night_competition(new.session_id) is distinct from new.competition_id then
    raise exception 'That session belongs to another competition';
  end if;
  return new;
end;
$$;

drop trigger if exists entries_session_same_comp on entries;
create trigger entries_session_same_comp
before insert or update of session_id, competition_id on entries
for each row execute function entries_session_same_comp();

drop policy if exists "admins write players" on players;
create policy "admins write players" on players for all
  using (can_admin(night_competition(night_id)))
  with check (
    can_admin(night_competition(night_id))
    and (
      players.entry_id is null
      or exists (
        select 1 from entries e
        where e.id = players.entry_id and e.competition_id = night_competition(players.night_id)
      )
    )
  );

-- 6. Who can correct a person's name ----------------------------------------------
-- Super, or an admin who runs every competition this person is entered in,
-- and the person isn't on an honours board, isn't in another competition's
-- qualifying results, and hasn't been merged away
create or replace function can_change_person(person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super() or (
    is_any_admin()
    and not exists (
      select 1 from entries e
      where (e.person_id = person or e.partner_id = person)
        and not can_admin(e.competition_id)
    )
    and not exists (
      select 1 from honours_history h
      where person in (h.winner_person_id, h.runner_up_person_id, h.winner_partner_id, h.runner_up_partner_id)
    )
    and not exists (
      select 1 from qualifier_events q
      where q.winner_person_id = person and not can_admin(q.competition_id)
    )
    and not exists (
      select 1 from qualifier_matches qm join qualifier_events q on q.id = qm.qualifier_event_id
      where person in (qm.person_a_id, qm.person_b_id) and not can_admin(q.competition_id)
    )
    and not exists (select 1 from people p where p.id = person and p.merged_into_id is not null)
  );
$$;

-- 7. Hidden people ------------------------------------------------------------------
drop policy if exists "read people" on people;
create policy "read people" on people for select
  using (
    not hidden
    or is_super()
    or exists (
      select 1 from entries e
      where (e.person_id = people.id or e.partner_id = people.id) and can_admin(e.competition_id)
    )
  );

-- 8. Merging and hiding stay with Super - now when adding someone too ------------
create or replace function people_guard() returns trigger
language plpgsql as $$
begin
  if is_super() or auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.hidden or new.merged_into_id is not null then
      raise exception 'Only Super can merge or hide people';
    end if;
  elsif new.merged_into_id is distinct from old.merged_into_id or new.hidden is distinct from old.hidden then
    raise exception 'Only Super can merge or hide people';
  end if;
  return new;
end;
$$;

drop trigger if exists people_guard on people;
create trigger people_guard
before insert or update on people
for each row execute function people_guard();

-- 9. The change log's time ------------------------------------------------------------
create or replace function audit_log_stamp() returns trigger
language plpgsql as $$
begin
  new.at := now();
  return new;
end;
$$;

drop trigger if exists audit_log_stamp on audit_log;
create trigger audit_log_stamp
before insert on audit_log
for each row execute function audit_log_stamp();

-- 10. Draws stay private until published ------------------------------------------
-- (the list of who's playing in a session is still public, as before)
drop policy if exists "public read matches" on matches;
create policy "public read matches" on matches for select
  using (
    exists (select 1 from nights n where n.id = matches.night_id and n.draw_published)
    or can_score(night_competition(night_id))
  );
drop policy if exists "public read match_events" on match_events;
create policy "public read match_events" on match_events for select
  using (
    exists (select 1 from nights n where n.id = match_events.night_id and n.draw_published)
    or can_score(night_competition(night_id))
  );

-- 11. Internal functions (the triggers that use them still work) ---------------------
revoke execute on function refresh_competition_names(uuid) from public, anon, authenticated;
revoke execute on function entry_display_name(uuid) from public, anon, authenticated;

commit;

-- What's in place now - every rule on every table (check nothing says
-- "auth write" and every table shows rowsecurity true):
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename, policyname;
select relname as table_name, relrowsecurity as rowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by relname;
