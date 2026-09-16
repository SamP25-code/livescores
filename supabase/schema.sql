-- Bowls Live: database schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- One row per qualifying night (1-4) plus one for finals day
create table nights (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. "Monday 12th October", "Finals Day - Saturday 17th October"
  kind text not null default 'qualifier' check (kind in ('qualifier', 'finals')),
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'complete')),
  sort_order int not null default 0,  -- controls display order in the public nav, regardless of creation order
  draw_published boolean not null default true,  -- while false, the public page shows only the roster,
                                                  -- not the generated bracket/matches - lets the admin
                                                  -- finish arranging the draw before revealing it
  created_at timestamptz not null default now()
);

-- Players entered on a given night (a finals-day player also exists as a
-- separate row here, since finals day is its own "night" - see
-- qualified_from_player_id below for how the two are linked)
create table players (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references nights(id) on delete cascade,
  name text not null,
  seed int,                            -- draw position (1-based). For finals day this IS the
                                        -- number the player drew on their qualifying night - it's
                                        -- what determines their finals-day pairing.
  finals_number int,                   -- set on a QUALIFYING night's player row once they qualify:
                                        -- the number they drew for finals day (shown for reference)
  qualified_from_player_id uuid references players(id) on delete set null,
                                        -- for a finals-day player row: which qualifying-night player
                                        -- row they came from, so re-saving their number or clearing
                                        -- it can find and update/remove the right finals-day row
  sort_order int not null default 0,   -- round-1 pairing order on a qualifying night (1 v 2, 3 v 4, ...),
                                        -- set by dragging players into position on the admin page
  is_bye boolean not null default false, -- marks a confirmed no-show at their exact draw position -
                                          -- their opponent advances without playing. Name is kept so
                                          -- this is easy to undo if toggled by mistake.
  created_at timestamptz not null default now()
);

-- Prevents two players landing on the same finals-day draw position by
-- accident (multiple NULL seeds - the normal case on qualifying nights - are
-- always allowed; Postgres doesn't treat NULLs as equal for this check)
alter table players add constraint players_night_seed_unique unique (night_id, seed);

-- Every match in the knockout tree for a night.
-- round 1 = first round, round 2 = quarters, etc. (meaning depends on night size)
create table matches (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references nights(id) on delete cascade,
  round int not null,
  slot int not null,                   -- position within the round, 0-based, used for bracket layout
  player_a_id uuid references players(id),
  player_b_id uuid references players(id),
  score_a int not null default 0,
  score_b int not null default 0,
  target_score int not null default 21,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'complete')),
  winner_id uuid references players(id),
  next_match_id uuid references matches(id),  -- which match the winner advances into
  next_match_slot text check (next_match_slot in ('a', 'b')), -- which side of that match
  updated_at timestamptz not null default now()
);

-- Belt-and-suspenders against ever generating a bracket twice for the same
-- night (e.g. two near-simultaneous page loads both finding no matches yet
-- and both generating one) - the second attempt's insert fails outright
-- instead of leaving duplicate/corrupted rounds.
alter table matches add constraint matches_night_round_slot_unique unique (night_id, round, slot);

-- One row per score/status change to a match, so the running score can be
-- shown as a timeline (both to the admin and publicly) rather than just the
-- current total - e.g. "2 shots scored, then 1, then complete 21-15".
-- night_id is duplicated from matches here purely so the public/admin pages
-- can subscribe to realtime changes for a whole night without a join.
create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  night_id uuid not null references nights(id) on delete cascade,
  event_type text not null check (event_type in ('score', 'complete', 'reopen', 'no_show')),
  score_a int not null,
  score_b int not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index on players (night_id);
create index on matches (night_id);
create index on matches (next_match_id);
create index on match_events (match_id);
create index on match_events (night_id);

-- Keep updated_at current on every score/status change
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger matches_set_updated_at
before update on matches
for each row execute function set_updated_at();

-- Row Level Security: public can read everything (it's a public scoreboard),
-- only authenticated users (you, logged in as admin) can write.
alter table nights enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table match_events enable row level security;

create policy "public read nights" on nights for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read match_events" on match_events for select using (true);

-- Two kinds of logged-in user: the owner (full control - the default for
-- any account with no role set, so the existing admin login is unaffected)
-- and a "scorer" - a second admin who can only work a match that's already
-- live to the public, and can't touch nights, players, or the draw itself.
-- A scorer's role is set via their auth.users.raw_app_meta_data, which only
-- an owner running SQL directly can change - never the user themselves.

create policy "owner write nights" on nights for all
  using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
  with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');

create policy "owner write players" on players for all
  using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
  with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');

create policy "owner write matches" on matches for all
  using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
  with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');

create policy "scorer update live matches" on matches for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'scorer'
    and exists (select 1 from nights n where n.id = matches.night_id and n.draw_published)
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'scorer'
    and exists (select 1 from nights n where n.id = matches.night_id and n.draw_published)
  );

create policy "owner write match_events" on match_events for all
  using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
  with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');

create policy "scorer insert match events" on match_events for insert
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'scorer'
    and exists (select 1 from nights n where n.id = match_events.night_id and n.draw_published)
  );

-- Enable realtime so the public page updates live
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table nights;
alter publication supabase_realtime add table match_events;

-- If you already ran this schema before `finals_number` was added above,
-- run this once instead of the whole file:
-- alter table players add column finals_number int;

-- If you already ran this schema before `sort_order` / `qualified_from_player_id`
-- were added above, run this once instead of the whole file:
-- alter table nights add column sort_order int not null default 0;
-- alter table players add column qualified_from_player_id uuid references players(id) on delete set null;
-- alter table players add constraint players_night_seed_unique unique (night_id, seed);

-- If you already ran this schema before `players.sort_order` (round-1 drag
-- order) was added above, run this once instead of the whole file - it adds
-- the column AND backfills it from each player's created_at, so any players
-- already entered on an in-progress night keep their current round-1
-- pairing order instead of all landing on the same default value:
-- alter table players add column sort_order int not null default 0;
-- with ordered as (
--   select id, row_number() over (partition by night_id order by created_at) - 1 as rn
--   from players
-- )
-- update players set sort_order = ordered.rn
-- from ordered
-- where players.id = ordered.id;

-- If you already ran this schema before `matches_night_round_slot_unique`
-- was added above, run this once instead of the whole file:
-- alter table matches add constraint matches_night_round_slot_unique unique (night_id, round, slot);

-- If you already ran this schema before `players.is_bye` was added above,
-- run this once instead of the whole file:
-- alter table players add column is_bye boolean not null default false;

-- If you already ran this schema before `match_events` (score history) was
-- added above, run this once instead of the whole file:
-- create table match_events (
--   id uuid primary key default gen_random_uuid(),
--   match_id uuid not null references matches(id) on delete cascade,
--   night_id uuid not null references nights(id) on delete cascade,
--   event_type text not null check (event_type in ('score', 'complete', 'reopen', 'no_show')),
--   score_a int not null,
--   score_b int not null,
--   status text not null,
--   created_at timestamptz not null default now()
-- );
-- create index on match_events (match_id);
-- create index on match_events (night_id);
-- alter table match_events enable row level security;
-- create policy "public read match_events" on match_events for select using (true);
-- create policy "auth write match_events" on match_events for all
--   using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- alter publication supabase_realtime add table match_events;

-- If you already ran this schema before `nights.draw_published` was added
-- above, run this once instead of the whole file. Defaults every existing
-- night to true (published) so nothing already live gets hidden by this -
-- new nights created afterwards start unpublished automatically.
-- alter table nights add column draw_published boolean not null default true;

-- If you already ran this schema before the scorer role was added above,
-- run this once instead of the whole file. Drops the old "any authenticated
-- user can do anything" policies and replaces them with the owner/scorer
-- split described above.
-- drop policy "auth write nights" on nights;
-- drop policy "auth write players" on players;
-- drop policy "auth write matches" on matches;
-- drop policy "auth write match_events" on match_events;
-- create policy "owner write nights" on nights for all
--   using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
--   with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');
-- create policy "owner write players" on players for all
--   using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
--   with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');
-- create policy "owner write matches" on matches for all
--   using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
--   with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');
-- create policy "scorer update live matches" on matches for update
--   using (
--     (auth.jwt() -> 'app_metadata' ->> 'role') = 'scorer'
--     and exists (select 1 from nights n where n.id = matches.night_id and n.draw_published)
--   )
--   with check (
--     (auth.jwt() -> 'app_metadata' ->> 'role') = 'scorer'
--     and exists (select 1 from nights n where n.id = matches.night_id and n.draw_published)
--   );
-- create policy "owner write match_events" on match_events for all
--   using (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer')
--   with check (auth.role() = 'authenticated' and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'owner') <> 'scorer');
-- create policy "scorer insert match events" on match_events for insert
--   with check (
--     (auth.jwt() -> 'app_metadata' ->> 'role') = 'scorer'
--     and exists (select 1 from nights n where n.id = match_events.night_id and n.draw_published)
--   );
--
-- Then, to actually make someone a scorer (run once per person, after
-- creating their login in Authentication > Users):
-- update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role": "scorer"}'::jsonb
--   where email = 'their-email@example.com';
--
-- To turn a scorer back into a full owner:
-- update auth.users set raw_app_meta_data = raw_app_meta_data - 'role'
--   where email = 'their-email@example.com';
