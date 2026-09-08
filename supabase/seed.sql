-- Bowls Live: seed the competition's nights
-- Run this once in Supabase's SQL editor, after schema.sql.
-- Safe to re-run: it skips any night whose name already exists.

insert into nights (name, kind, sort_order)
select v.name, v.kind, v.sort_order
from (values
  ('Monday 12th October', 'qualifier', 1),
  ('Tuesday 13th October', 'qualifier', 2),
  ('Wednesday 14th October', 'qualifier', 3),
  ('Thursday 15th October', 'qualifier', 4),
  ('Finals Day - Saturday 17th October', 'finals', 5)
) as v(name, kind, sort_order)
where not exists (
  select 1 from nights where nights.name = v.name
);
