-- 2027 multi-competition site - part 6: which qualifying session each entry plays
-- Run AFTER parts 1 to 5, on the TEST project first.
--
-- In a competition with qualifying sessions (like the October Singles), each
-- entry is entered straight into one session; that session's draw is then made
-- from the people entered for it. Single-day and final-only competitions leave
-- this empty - everyone entered is in the one draw.
--
-- The 2026 October Singles entries are given the session they played in.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

alter table entries add column session_id uuid references nights(id) on delete set null;
create index on entries (session_id);

update entries e
set session_id = pl.night_id
from players pl
join nights n on n.id = pl.night_id
where pl.entry_id = e.id
  and n.kind = 'qualifier';

commit;
