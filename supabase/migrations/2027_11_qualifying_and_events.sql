-- 2027 multi-competition site - part 11: qualifying competitions and event pages
-- Run AFTER parts 1 to 10, on the TEST project first.
--
-- 1. Events (like the Blackpool Masters) get a web address of their own, for
--    their event page: /blackpool-masters.
-- 2. Qualifying competitions: a competition entered by qualification (the
--    Masters Invitation 32) has places, each filled by the winner of a
--    qualifying competition - one run on this site, or one that isn't, whose
--    results are entered here (just the winner, the final, the semi-finals
--    and final, or the quarter-finals onwards) - or a wildcard.
-- 3. Posts on an event's page: news, qualifier updates and adverts, with an
--    optional picture. Only Super adds them.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

-- 1. Event addresses ----------------------------------------------------------
alter table organisers add column slug text;
update organisers
set slug = trim(both '-' from regexp_replace(lower(replace(short_name, '&', 'and')), '[^a-z0-9]+', '-', 'g'))
where slug is null;
create unique index organisers_slug_key on organisers (slug);

-- 2. Qualifying competitions ---------------------------------------------------
-- One qualifying competition for one competition's place
create table qualifier_events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade, -- what it qualifies for
  name text not null check (btrim(name) <> ''),       -- "Fylde Classic"
  location text,                                      -- "Kirkham"
  final_date date,
  -- Run on this site: its champion fills the place by itself
  source_competition_id uuid references competitions(id) on delete set null,
  -- Not on this site: how much of it is entered here
  results_depth text not null default 'final'
    check (results_depth in ('winner', 'final', 'semis', 'quarters')),
  -- "Just the winner" - who won, with no scores
  winner_person_id uuid references people(id),
  created_at timestamptz not null default now()
);
create index on qualifier_events (competition_id);

-- Its results, round by round (final = round 1, semi-finals = 2, quarters = 3)
create table qualifier_matches (
  id uuid primary key default gen_random_uuid(),
  qualifier_event_id uuid not null references qualifier_events(id) on delete cascade,
  stage int not null check (stage between 1 and 3),
  slot int not null check (slot >= 0),
  person_a_id uuid references people(id),
  person_b_id uuid references people(id),
  score_a int check (score_a >= 0),
  score_b int check (score_b >= 0),
  unique (qualifier_event_id, stage, slot)
);

alter table qualifying_places
  add column qualifier_event_id uuid references qualifier_events(id) on delete set null;

alter table qualifier_events enable row level security;
alter table qualifier_matches enable row level security;
create policy "public read qualifier_events" on qualifier_events for select using (true);
create policy "public read qualifier_matches" on qualifier_matches for select using (true);
create policy "admins write qualifier_events" on qualifier_events for all
  using (can_admin(competition_id)) with check (can_admin(competition_id));
create policy "admins write qualifier_matches" on qualifier_matches for all
  using (exists (select 1 from qualifier_events q where q.id = qualifier_event_id and can_admin(q.competition_id)))
  with check (exists (select 1 from qualifier_events q where q.id = qualifier_event_id and can_admin(q.competition_id)));

-- 3. Posts on an event's page --------------------------------------------------
create table event_posts (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references organisers(id) on delete cascade,
  year int not null,
  kind text not null check (kind in ('news', 'qualifier', 'advert')),
  title text not null check (btrim(title) <> ''),
  body text,
  image_url text,
  link_url text check (link_url is null or link_url ~ '^https://'),
  qualifier_event_id uuid references qualifier_events(id) on delete set null,
  show_from date not null default current_date,
  pinned boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index on event_posts (organiser_id, year, show_from desc);

alter table event_posts enable row level security;
-- Everyone sees published posts once their date comes; Super sees drafts too
create policy "read event_posts" on event_posts for select
  using ((published and show_from <= current_date) or is_super());
create policy "super write event_posts" on event_posts for all
  using (is_super()) with check (is_super());

-- Pictures for posts: public to view, images only, up to 5 MB; Super uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "super uploads event images" on storage.objects for insert
  with check (bucket_id = 'event-images' and is_super());
create policy "super changes event images" on storage.objects for update
  using (bucket_id = 'event-images' and is_super()) with check (bucket_id = 'event-images' and is_super());
create policy "super removes event images" on storage.objects for delete
  using (bucket_id = 'event-images' and is_super());

commit;
