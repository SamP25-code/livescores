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

create index on players (night_id);
create index on matches (night_id);
create index on matches (next_match_id);

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

create policy "public read nights" on nights for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read matches" on matches for select using (true);

create policy "auth write nights" on nights for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write players" on players for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth write matches" on matches for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Enable realtime so the public page updates live
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table nights;

-- If you already ran this schema before `finals_number` was added above,
-- run this once instead of the whole file:
-- alter table players add column finals_number int;

-- If you already ran this schema before `sort_order` / `qualified_from_player_id`
-- were added above, run this once instead of the whole file:
-- alter table nights add column sort_order int not null default 0;
-- alter table players add column qualified_from_player_id uuid references players(id) on delete set null;
-- alter table players add constraint players_night_seed_unique unique (night_id, seed);
