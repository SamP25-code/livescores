-- 2027 multi-competition site - part 24: main and associate event sponsors
-- Run AFTER part 21, on the TEST project first. Safe to run more than once.
--
-- An event's sponsors can be its main sponsor (shown large at the top of the
-- event's page) or an associate sponsor (shown smaller underneath, labelled).
-- Every sponsor already there stays a main sponsor.

begin;

alter table event_sponsors
  add column if not exists tier text not null default 'main'
  check (tier in ('main', 'associate'));

commit;
