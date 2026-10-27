-- Qualifying competitions (the Blackpool Masters' qualifiers): where each is
-- played is picked from Clubs, so it links to that club's page and its
-- directions; and results can be entered from the last 16.
alter table qualifier_events add column if not exists venue_id uuid references venues(id) on delete set null;

alter table qualifier_events drop constraint if exists qualifier_events_results_depth_check;
alter table qualifier_events add constraint qualifier_events_results_depth_check
  check (results_depth in ('winner', 'final', 'semis', 'quarters', 'last16'));
