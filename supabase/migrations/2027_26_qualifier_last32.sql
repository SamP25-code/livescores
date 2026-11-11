-- 2027 multi-competition site - part 26: qualifier results from the last 32
-- Run AFTER parts 19 and 20, on the TEST project first. Safe to run more
-- than once.
--
-- A qualifying competition's results can now be entered from the last 32
-- (stage 5: 16 matches), as well as from the last 16, quarters, semis or
-- just the final.

begin;

alter table qualifier_events drop constraint if exists qualifier_events_results_depth_check;
alter table qualifier_events add constraint qualifier_events_results_depth_check
  check (results_depth in ('winner', 'final', 'semis', 'quarters', 'last16', 'last32'));

alter table qualifier_matches drop constraint if exists qualifier_matches_stage_check;
alter table qualifier_matches add constraint qualifier_matches_stage_check check (stage between 1 and 5);

commit;
