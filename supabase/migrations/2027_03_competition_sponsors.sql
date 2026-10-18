-- 2027 multi-competition site - part 3: more than one sponsor per competition
-- Run AFTER parts 1 and 2, on the TEST project first.
--
-- Each competition can have any number of sponsors, shown in order. The single
-- sponsor_name / sponsor_url already stored on a competition (e.g. Verve Wills on
-- the October Singles 2026) is copied across as its first sponsor; those two old
-- columns are then no longer used.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

create table competition_sponsors (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  position int not null default 1,        -- order shown: 1 first
  name text not null check (btrim(name) <> ''),
  url text,
  created_at timestamptz not null default now()
);
create index on competition_sponsors (competition_id, position);

alter table competition_sponsors enable row level security;
create policy "public read competition_sponsors" on competition_sponsors for select using (true);
create policy "super write competition_sponsors" on competition_sponsors for all
  using (is_super()) with check (is_super());

-- Copy each competition's existing single sponsor across
insert into competition_sponsors (competition_id, position, name, url)
select id, 1, btrim(sponsor_name), nullif(btrim(coalesce(sponsor_url, '')), '')
from competitions
where sponsor_name is not null and btrim(sponsor_name) <> '';

commit;
