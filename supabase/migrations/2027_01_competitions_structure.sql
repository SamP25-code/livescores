-- 2027 multi-competition site - part 1: new structure and security rules
-- See docs/database-design.md. Run in the Supabase SQL Editor on the TEST project first.
--
-- Adds tables and columns only - no existing data is changed or removed. It does
-- replace the old "owner"/"scorer" write rules with Super / Admin / Scorer rules,
-- so after running it only a login marked Super (part 2, or the line below)
-- can change anything until admins and scorers are assigned to competitions.
--
-- Safe to run once. Wrapped in a transaction: if any step fails, nothing is kept.
--
-- AFTER RUNNING: mark your own login as Super (use your email for this project) by
-- running this on its own. Takes effect the next time you sign in:
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role": "super"}'::jsonb
--     where email = 'your-email@example.com';

begin;

-- ---------------------------------------------------------------------------
-- Who runs competitions (behind the scenes only - no public club pages)
-- ---------------------------------------------------------------------------
create table organisers (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- "Penwortham Sports & Social Club"
  short_name text not null,              -- "Penwortham" - shown as "Run by Penwortham"
  kind text not null check (kind in ('club', 'event')),
  background_image text,                 -- optional per-organiser photo
  created_at timestamptz not null default now()
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  postcode text,                         -- used for the "Get directions" link
  notes text,                            -- "Parking on site. Bar open, seating available"
  created_at timestamptz not null default now()
);

-- A competition that repeats every year: gives the year-less address
-- (/october-singles opens the latest year) and holds the honours board.
create table series (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references organisers(id),
  name text not null,                    -- "October Singles"
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

-- One year's edition of a series, with its settings. Set up by Super only;
-- structure_locked is set when the first draw is made.
create table competitions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id),
  year int not null check (year between 2000 and 2100),
  status text not null default 'planned' check (status in ('planned', 'active', 'archived')),
  format text not null check (format in ('qualifying_and_finals', 'single_day', 'final_only')),
  team_size int not null default 1 check (team_size in (1, 2)),   -- 1 singles, 2 pairs
  entry_method text not null default 'open' check (entry_method in ('open', 'qualification', 'on_the_night')),
  label text,                            -- e.g. "Ladies"
  target_score int not null default 21 check (target_score in (21, 31)),
  scoring_style text not null default 'live' check (scoring_style in ('live', 'results')),
  draw_size int check (draw_size >= 2),  -- Finals Day / single day draw
  qualifying_nights int check (qualifying_nights >= 1),
  entries_per_night int check (entries_per_night >= 2),
  qualifiers_per_night int check (qualifiers_per_night >= 1),
  draw_method text not null default 'in_advance' check (draw_method in ('in_advance', 'on_the_day')),
  structure_locked boolean not null default false,
  sponsor_name text,
  sponsor_url text,
  venue_id uuid references venues(id),
  colour text,                           -- calendar colour; auto-assigned if empty
  created_at timestamptz not null default now(),
  unique (series_id, year),
  -- the numbers have to add up for a qualifying competition
  check (
    format <> 'qualifying_and_finals'
    or (qualifying_nights is not null and entries_per_night is not null
        and qualifiers_per_night is not null and draw_size is not null
        and qualifying_nights * qualifiers_per_night <= draw_size)
  )
);

-- ---------------------------------------------------------------------------
-- Sessions: today's nights table, extended (a qualifying night, a Finals Day
-- or a single day)
-- ---------------------------------------------------------------------------
alter table nights
  add column competition_id uuid references competitions(id) on delete cascade,
  add column session_number int,
  add column date date,
  add column start_time time,
  add column venue_id uuid references venues(id),
  add column postponed boolean not null default false,
  add column postponed_reason text,
  add column original_date date;

alter table nights alter column name drop not null;   -- generated from date + kind when empty
alter table nights drop constraint if exists nights_kind_check;
alter table nights add constraint nights_kind_check
  check (kind in ('qualifier', 'finals', 'single_day', 'final'));

create index on nights (competition_id);
create index on nights (date);

-- ---------------------------------------------------------------------------
-- People and entries
-- ---------------------------------------------------------------------------
create table people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (btrim(full_name) <> ''),
  note text,                             -- "Snr", "Jnr", "John A. Smith" - tells same names apart
  club_id uuid references organisers(id),
  hidden boolean not null default false, -- privacy: name removed on request
  merged_into_id uuid references people(id),
  created_at timestamptz not null default now()
);
create index on people (lower(full_name));

-- A person (singles) or a pair (doubles) entered into one competition
create table entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  person_id uuid not null references people(id),
  partner_id uuid references people(id),
  status text not null default 'entered' check (status in ('entered', 'withdrawn')),
  created_at timestamptz not null default now(),
  check (partner_id is null or partner_id <> person_id)
);
create index on entries (competition_id);
create index on entries (person_id);
create index on entries (partner_id);

-- A pair must have two people and a singles entry one, and nobody can be in
-- the same competition twice (as player or partner).
create or replace function check_entry() returns trigger as $$
declare
  size int;
begin
  select team_size into size from competitions where id = new.competition_id;
  if size = 2 and new.partner_id is null then
    raise exception 'A doubles entry needs two people';
  end if;
  if size = 1 and new.partner_id is not null then
    raise exception 'A singles entry has one person';
  end if;
  if new.status = 'entered' and exists (
    select 1 from entries e
    where e.competition_id = new.competition_id
      and e.id <> new.id
      and e.status = 'entered'
      and (e.person_id in (new.person_id, new.partner_id)
           or e.partner_id in (new.person_id, new.partner_id))
  ) then
    raise exception 'That person is already entered in this competition';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger entries_check
before insert or update on entries
for each row execute function check_entry();

-- ---------------------------------------------------------------------------
-- Places in a draw: today's players table, now pointing at an entry
-- ---------------------------------------------------------------------------
alter table players add column entry_id uuid references entries(id);
alter table players alter column name drop not null;  -- names come from the entry's people
create index on players (entry_id);

-- ---------------------------------------------------------------------------
-- Matches: start time (from time slots) and when they finished
-- ---------------------------------------------------------------------------
alter table matches
  add column start_at timestamptz,
  add column completed_at timestamptz;

create table time_slots (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references nights(id) on delete cascade,
  from_number int not null check (from_number >= 1),
  to_number int not null,
  start_time time not null,
  check (to_number >= from_number)
);
create index on time_slots (night_id);

-- ---------------------------------------------------------------------------
-- Who can run or score which competition. Super is a mark on the login
-- itself (app_metadata role 'super'), not an assignment.
-- ---------------------------------------------------------------------------
create table assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  role text not null check (role in ('admin', 'scorer')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, competition_id)
);
create index on assignments (competition_id);

-- Every important change: draws, replacements, corrections, postponements...
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  competition_id uuid references competitions(id) on delete cascade,
  action text not null,                  -- draw_made, replaced, result_corrected, postponed...
  details jsonb not null default '{}'::jsonb
);
create index on audit_log (competition_id, at desc);

-- ---------------------------------------------------------------------------
-- Later in 2027 (designed now, used after 13 March)
-- ---------------------------------------------------------------------------
create table qualifying_places (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  place_number int not null check (place_number >= 1),
  source text not null check (source in ('winner_of', 'runner_up_of', 'typed_in', 'wildcard')),
  source_competition_id uuid references competitions(id),
  source_label text not null,            -- "Winner - October Singles 2027 (Penwortham)"
  entry_id uuid references entries(id),
  original_source_label text,            -- kept when changed to a wildcard
  flagged text,                          -- "Already qualified via the October Singles"
  unique (competition_id, place_number)
);

create table honours_history (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references series(id) on delete cascade,
  year int not null,
  winner_person_id uuid references people(id),
  runner_up_person_id uuid references people(id),
  winner_text text,
  runner_up_text text,
  unique (series_id, year)
);

-- ---------------------------------------------------------------------------
-- Permission helpers. security definer so they can read assignments without
-- tripping that table's own rules.
-- ---------------------------------------------------------------------------
create or replace function is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'super';
$$;

create or replace function can_admin(comp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super() or exists (
    select 1 from assignments
    where user_id = auth.uid() and competition_id = comp and role = 'admin'
  );
$$;

create or replace function can_score(comp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select can_admin(comp) or exists (
    select 1 from assignments
    where user_id = auth.uid() and competition_id = comp and role = 'scorer'
  );
$$;

-- An admin of at least one competition (may add people to the shared list)
create or replace function is_any_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select is_super() or exists (
    select 1 from assignments where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function night_competition(night uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select competition_id from nights where id = night;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table organisers enable row level security;
alter table venues enable row level security;
alter table series enable row level security;
alter table competitions enable row level security;
alter table people enable row level security;
alter table entries enable row level security;
alter table time_slots enable row level security;
alter table assignments enable row level security;
alter table audit_log enable row level security;
alter table qualifying_places enable row level security;
alter table honours_history enable row level security;

-- Public reading
create policy "public read organisers" on organisers for select using (true);
create policy "public read venues" on venues for select using (true);
create policy "public read series" on series for select using (true);
create policy "public read competitions" on competitions for select using (true);
create policy "public read entries" on entries for select using (true);
create policy "public read time_slots" on time_slots for select using (true);
create policy "public read qualifying_places" on qualifying_places for select using (true);
create policy "public read honours_history" on honours_history for select using (true);
-- Hidden people (privacy) are only visible to admins; pages show "Withdrawn player"
create policy "read people" on people for select using (not hidden or is_any_admin());

-- Super only: the set-up of competitions
create policy "super write organisers" on organisers for all using (is_super()) with check (is_super());
create policy "super write venues" on venues for all using (is_super()) with check (is_super());
create policy "super write series" on series for all using (is_super()) with check (is_super());
create policy "super write competitions" on competitions for all using (is_super()) with check (is_super());
create policy "super write honours_history" on honours_history for all using (is_super()) with check (is_super());

-- People: any admin can add someone; changing or merging people is Super only
create policy "admins add people" on people for insert with check (is_any_admin());
create policy "super change people" on people for update using (is_super()) with check (is_super());
create policy "super remove people" on people for delete using (is_super());

-- Running a competition: its admins (and Super)
create policy "admins write entries" on entries for all
  using (can_admin(competition_id)) with check (can_admin(competition_id));
create policy "admins write time_slots" on time_slots for all
  using (can_admin(night_competition(night_id))) with check (can_admin(night_competition(night_id)));
create policy "admins write qualifying_places" on qualifying_places for all
  using (can_admin(competition_id)) with check (can_admin(competition_id));

-- Assignments: you can see your own; admins see and add scorers for their
-- competitions; Super does anything
create policy "read assignments" on assignments for select
  using (user_id = auth.uid() or can_admin(competition_id));
create policy "admins add scorers" on assignments for insert
  with check (is_super() or (role = 'scorer' and can_admin(competition_id)));
create policy "admins remove scorers" on assignments for delete
  using (is_super() or (role = 'scorer' and can_admin(competition_id)));
create policy "super change assignments" on assignments for update
  using (is_super()) with check (is_super());

-- Audit log: written as things happen by whoever does them; read by the
-- competition's admins; never changed
create policy "log changes" on audit_log for insert
  with check (user_id = auth.uid() and ((competition_id is null and is_super()) or can_score(competition_id)));
create policy "admins read log" on audit_log for select
  using (is_super() or can_admin(competition_id));

-- Replace the old owner/scorer write rules on the existing tables
drop policy if exists "owner write nights" on nights;
drop policy if exists "owner write players" on players;
drop policy if exists "owner write matches" on matches;
drop policy if exists "scorer update live matches" on matches;
drop policy if exists "owner write match_events" on match_events;
drop policy if exists "scorer insert match events" on match_events;
drop policy if exists "owner read viewer_pings" on viewer_pings;

-- Sessions: Super creates and removes them (part of the set-up); admins
-- update them (publish the draw, postpone, move a date)
create policy "super add nights" on nights for insert with check (is_super());
create policy "super remove nights" on nights for delete using (is_super());
create policy "admins update nights" on nights for update
  using (can_admin(competition_id)) with check (can_admin(competition_id));

create policy "admins write players" on players for all
  using (can_admin(night_competition(night_id))) with check (can_admin(night_competition(night_id)));

create policy "admins write matches" on matches for all
  using (can_admin(night_competition(night_id))) with check (can_admin(night_competition(night_id)));
create policy "scorers update published matches" on matches for update
  using (can_score(night_competition(night_id))
         and exists (select 1 from nights n where n.id = matches.night_id and n.draw_published))
  with check (can_score(night_competition(night_id))
         and exists (select 1 from nights n where n.id = matches.night_id and n.draw_published));

create policy "admins write match_events" on match_events for all
  using (can_admin(night_competition(night_id))) with check (can_admin(night_competition(night_id)));
create policy "scorers add match_events" on match_events for insert
  with check (can_score(night_competition(night_id))
         and exists (select 1 from nights n where n.id = match_events.night_id and n.draw_published));

create policy "admins read viewer_pings" on viewer_pings for select
  using (can_admin(night_competition(night_id)));

-- Live updates for the new tables the pages watch
alter publication supabase_realtime add table time_slots;
alter publication supabase_realtime add table entries;

commit;
