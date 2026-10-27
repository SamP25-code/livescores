-- 1. Each session's summary, worked out by the database: how many matches,
--    how many live, where it's up to, and its final's winner and runner-up.
--    The public pages read this (one row per session) instead of every
--    match ever played - which would stop adding up past 1,000 matches.
--    Same rules as computeNightStatus in lib/bracket.ts.
create or replace view night_summaries with (security_invoker = true) as
select
  s.night_id,
  s.match_count,
  s.live_count,
  case
    when s.last_round_done then 'complete'
    when s.started then 'live'
    else 'upcoming'
  end as status,
  f.winner_id as final_winner_id,
  case when f.winner_id = f.player_a_id then f.player_b_id else f.player_a_id end as final_loser_id
from (
  select
    m.night_id,
    count(*)::int as match_count,
    (count(*) filter (where m.status = 'live'))::int as live_count,
    bool_and(m.status = 'complete') filter (where m.round = lr.last_round) as last_round_done,
    (count(*) filter (where m.round = lr.last_round))::int as last_round_count,
    lr.last_round,
    bool_or(m.status <> 'upcoming') as started
  from matches m
  join (select night_id, max(round) as last_round from matches group by night_id) lr using (night_id)
  group by m.night_id, lr.last_round
) s
left join lateral (
  -- The final: the one match in the last round, finished with a winner
  select f.winner_id, f.player_a_id, f.player_b_id
  from matches f
  where f.night_id = s.night_id
    and f.round = s.last_round
    and s.last_round_count = 1
    and f.status = 'complete'
    and f.winner_id is not null
) f on true;

-- 2. How many are entered in each competition (one row per competition)
create or replace view competition_entry_counts with (security_invoker = true) as
select competition_id, count(*)::int as entered
from entries
where status = 'entered'
group by competition_id;

-- 3. A full session (or a full one-day draw) takes no more entries - the
--    same rule the admin screens check, now kept by the database too, so two
--    admins adding at once can't make 17 of 16.
create or replace function entries_not_over_full() returns trigger
language plpgsql as $$
declare
  comp record;
  taken int;
  session_no int;
begin
  if new.status <> 'entered' then
    return new;
  end if;
  -- Unchanged entries (a name corrected) don't need checking
  if tg_op = 'UPDATE' and old.status = 'entered' and old.session_id is not distinct from new.session_id then
    return new;
  end if;
  select format, entries_per_night, draw_size into comp from competitions where id = new.competition_id;
  if comp.format = 'qualifying_and_finals' then
    if new.session_id is null or comp.entries_per_night is null then
      return new;
    end if;
    select count(*) into taken from entries
      where session_id = new.session_id and status = 'entered' and id <> new.id;
    if taken >= comp.entries_per_night then
      select session_number into session_no from nights where id = new.session_id;
      raise exception 'Session % is full - % of %.', coalesce(session_no::text, ''), taken, comp.entries_per_night
        using errcode = 'P0001';
    end if;
  elsif comp.format = 'single_day' and comp.draw_size is not null then
    select count(*) into taken from entries
      where competition_id = new.competition_id and status = 'entered' and id <> new.id;
    if taken >= comp.draw_size then
      raise exception 'The draw is full - % of %.', taken, comp.draw_size using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists entries_not_over_full on entries;
create trigger entries_not_over_full
before insert or update of status, session_id on entries
for each row execute function entries_not_over_full();
