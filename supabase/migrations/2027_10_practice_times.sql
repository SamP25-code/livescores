-- 2027 multi-competition site - part 10: a practice time for each session
-- Run AFTER parts 1 to 9, on the TEST project first.
--
-- Each session has a start time; now it can have a practice time too, shown
-- on the public pages ("Practice 6pm · Start 6:30pm"). Leave it empty for no
-- practice. Sessions that already have a start time get practice half an
-- hour before it to begin with (as the October Singles always had) - change
-- it in the competition's settings.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

alter table nights add column practice_time time;

update nights
set practice_time = start_time - interval '30 minutes'
where start_time is not null and practice_time is null;

commit;
