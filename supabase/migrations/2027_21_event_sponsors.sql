-- 2027 multi-competition site - part 21: sponsors of a whole event
-- Run AFTER parts 1 to 20, on the TEST project first.
--
-- An event (e.g. the Blackpool Masters 2027) can have its own sponsors, as
-- well as each competition's. An event is an organiser in a year, so they're
-- kept against both. Same columns as competition_sponsors; logos go in the
-- same "sponsor-logos" folder.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

create table event_sponsors (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references organisers(id) on delete cascade,
  year int not null,
  position int not null default 1,        -- order shown: 1 first
  name text not null check (btrim(name) <> ''),
  url text,
  logo_url text,
  created_at timestamptz not null default now()
);
create index on event_sponsors (organiser_id, year, position);

alter table event_sponsors enable row level security;
create policy "public read event_sponsors" on event_sponsors for select using (true);
create policy "super write event_sponsors" on event_sponsors for all
  using (is_super()) with check (is_super());

commit;
