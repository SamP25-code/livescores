-- 2027 multi-competition site - part 23: keep-alive log
-- Safe to run on its own, on either project, at any time.
--
-- One row holding the last time /api/keepalive ran, so it can be seen in the
-- Supabase table editor (the Vercel cron gives no history on the free plan).
-- The route writes it with the service role key; nobody else can read or
-- write it (row level security on, no policies).

begin;

create table if not exists keepalive (
  id int primary key default 1 check (id = 1),
  at timestamptz not null default now()
);

alter table keepalive enable row level security;

insert into keepalive (id) values (1) on conflict (id) do nothing;

commit;
