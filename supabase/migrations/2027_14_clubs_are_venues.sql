-- Clubs and venues become one list: every club has its green (a venue row,
-- holding the address, postcode, map link and notes), and every venue is a
-- club. Run once; safe to run again.

-- 1. A venue and a club with the same name are the same place
update organisers o
set venue_id = v.id
from venues v
where o.kind = 'club'
  and o.venue_id is null
  and lower(btrim(o.name)) = lower(btrim(v.name))
  and not exists (select 1 from organisers x where x.venue_id = v.id);

-- 2. A club for every venue that hasn't one (Marton Institute). Its web
-- address comes from its name, with a little of its id if that's taken.
insert into organisers (name, short_name, kind, slug, venue_id)
select
  v.name,
  v.name,
  'club',
  case
    when exists (select 1 from organisers o where o.slug = s.slug) then s.slug || '-' || left(v.id::text, 4)
    else s.slug
  end,
  v.id
from venues v
cross join lateral (
  select btrim(regexp_replace(lower(replace(v.name, '&', 'and')), '[^a-z0-9]+', '-', 'g'), '-') as slug
) s
where not exists (select 1 from organisers o where o.venue_id = v.id);

-- 3. A green for every club that hasn't one (details filled in on Clubs)
do $$
declare
  club record;
  new_id uuid;
begin
  for club in select id, name from organisers where kind = 'club' and venue_id is null loop
    insert into venues (name) values (club.name) returning id into new_id;
    update organisers set venue_id = new_id where id = club.id;
  end loop;
end $$;
