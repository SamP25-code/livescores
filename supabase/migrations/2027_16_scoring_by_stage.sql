-- Scoring chosen for each stage: a competition with qualifying sessions can
-- take results only on those and score Finals Day live (or any mix).
-- scoring_style stays as the Finals Day / one-day setting.
alter table competitions add column if not exists qualifying_scoring text not null default 'results'
  check (qualifying_scoring in ('live', 'results'));

-- Until now qualifying sessions were always results only and Finals Day
-- always live, whatever the setting said - keep them exactly that way
update competitions set scoring_style = 'live' where format = 'qualifying_and_finals';
