-- TEST DATABASE (bowls-live-test).
--
-- Loads the 2027 Blackpool Masters field (the qualifying list sheet) into
-- the Masters 2027 competition: one qualifying competition and place per
-- line, in date order, then wildcards up to 4. Safe to run again - a
-- qualifying competition already there (same name) is skipped, and wildcards
-- are only added to bring them up to 4.
--
-- Where each is played: a club already in Clubs with the same postcode (or
-- name) is used; otherwise a club is made with its address and postcode, so
-- it links to its page and directions. The Isle of Man qualifiers are all
-- at Nobles Park for now (a club with no postcode yet).
--
-- Dates marked TBC are left empty. Red (provisional) dates are entered as
-- they are - change them on the qualifying page when confirmed.
--
-- The 2026 defending champion and the 2026 Champion of Champions aren't in
-- this list - they're already on the site, with their finals' scores.
--
-- STEP 1 - run this on its own first. It should list exactly one
-- competition (the Masters 2027, entered by qualification), with what it
-- already has:
--
--   select s.name, c.year, c.entry_method,
--          (select count(*) from qualifier_events q where q.competition_id = c.id) as qualifiers,
--          (select count(*) from qualifying_places p where p.competition_id = c.id) as places
--   from competitions c
--   join series s on s.id = c.series_id
--   join organisers o on o.id = s.organiser_id
--   where o.slug = 'blackpool-masters' and c.year = 2027 and c.entry_method = 'qualification';
--
-- STEP 2 - run everything below. The last result lists the places.

begin;

create temp table bm_field (
  n int,
  name text,
  final_date date,
  club text,
  address text,
  postcode text         -- null: not known yet
) on commit drop;

insert into bm_field values
  ( 1, 'Derek Kilgariff Trophy',                    '2027-03-28', 'London Road BC',                'Newcastle',                       'ST5 1LZ'),
  ( 2, 'Coors Meole Brace Open',                    '2027-04-04', 'Meole Brace BC',                'Shrewsbury',                      'SY3 9JF'),
  ( 3, 'Min-Y-Don Open',                            '2027-04-04', 'Min-Y-Don BC',                  'Old Colwyn, Colwyn Bay',          'LL29 9SD'),
  ( 4, 'Spring Waterloo',                           '2027-05-03', 'Fleetwood BC',                  'Fleetwood',                       'FY7 6BP'),
  ( 5, 'New Brighton Classic',                      '2027-05-03', 'New Brighton C & BC',           'Wallasey',                        'CH45 5DE'),
  ( 6, 'Tom Boyd Memorial',                         '2027-05-29', 'Woodlands Park Club',           'Doncaster',                       'DN6 7RA'),
  ( 7, 'The Drakes Pride & Jones Family Big Smash',  '2027-05-30', 'Dalton CC',                     'Ulverston Rd, Dalton-in-Furness', 'LA15 8EY'),
  ( 8, 'Elland VMC Classic',                        '2027-06-20', 'Elland VMC',                    'Elland',                          'HX5 0HT'),
  ( 9, 'Isle of Man June',                          '2027-06-25', 'Nobles Park',                   'Douglas, Isle of Man',            null),
  (10, 'Cleckheaton Classic One Day 64',            '2027-07-03', 'Cleckheaton Sports BC',         'Cleckheaton',                     'BD19 3UD'),
  (11, '2026 Senior Individual Merit',              '2027-07-24', 'Longton',                       'Longton, nr Preston',             'PR4 5DL'),
  (12, 'Brighouse Classic',                         '2027-08-14', 'Brighouse Sports Club',         'Brighouse',                       'HD6 4LX'),
  (13, 'Pudsey Classic',                            '2027-08-15', 'Pudsey Bowling Club',           'Pudsey',                          'LS28 8JQ'),
  (14, 'Isle of Man September',                     '2027-09-10', 'Nobles Park',                   'Douglas, Isle of Man',            null),
  (15, 'Autumn Waterloo',                           '2027-09-12', 'Fleetwood BC',                  'Fleetwood',                       'FY7 6BP'),
  (16, 'Talbot Trophy',                             '2027-09-17', 'Layton Institute',              'Blackpool',                       'FY3 7HG'),
  (17, 'Houldsworth (Frank Beeley Trophy)',         null,         'Houldsworth VMC',               'Stockport',                       'SK5 6BD'),
  (18, 'James Kelly-Valley Memorial',               null,         'Belvedere BC',                  'Burton-on-Trent',                 'DE13 0RQ'),
  (19, 'Walsden Brian Howley Mens Classic',         null,         'Walsden Cricket & Bowling',     'nr Todmorden',                    'OL14 7SX'),
  (20, 'IOM Blackpool Masters Qualifier',           null,         'Nobles Park',                   'Douglas, Isle of Man',            null),
  (21, 'Bellingham Classic',                        null,         'Bellingham BC',                 'New Lodge, Wigan',                'WN1 2NB'),
  (22, 'Fylde Coast Blackpool Masters Qualifier',   null,         'Marton Institute',              'Blackpool',                       'FY4 4DR'),
  (23, 'Reg Miller Stockingford One Day',           null,         'Stockingford AA BC',            'Nuneaton',                        'CV10 8LT'),
  (24, 'George Davies Memorial',                    null,         'Penn B & SC',                   'Penn, Wolverhampton',             'WV4 5PY'),
  (25, 'West Brom Open (Alan Bentley Memorial)',    null,         'West Brom FSC',                 'West Bromwich',                   'B70 8LD'),
  (26, 'Castle Private',                            null,         'Castle Sports & SC',            'Northwich',                       'CW8 1HE');

do $$
declare
  comp uuid;
  r record;
  v uuid;
  club_short text;
  ev uuid;
  next_place int;
  wildcards int;
  new_slug text;
  added int := 0;
begin
  select c.id into comp
  from competitions c
  join series s on s.id = c.series_id
  join organisers o on o.id = s.organiser_id
  where o.slug = 'blackpool-masters' and c.year = 2027 and c.entry_method = 'qualification';
  if comp is null then
    raise exception 'No Blackpool Masters 2027 competition entered by qualification - check step 1. Nothing added.';
  end if;
  if (select count(*) from competitions c join series s on s.id = c.series_id join organisers o on o.id = s.organiser_id
      where o.slug = 'blackpool-masters' and c.year = 2027 and c.entry_method = 'qualification') > 1 then
    raise exception 'More than one Blackpool Masters 2027 competition entered by qualification - check step 1. Nothing added.';
  end if;

  for r in select * from bm_field order by n loop
    if exists (select 1 from qualifier_events q where q.competition_id = comp and lower(btrim(q.name)) = lower(r.name)) then
      raise notice 'Already there, skipped: %', r.name;
      continue;
    end if;

    -- Where it's played: a club in Clubs, found by postcode or name, or a new one
    v := null;
    club_short := null;
    select o.venue_id, o.short_name into v, club_short
    from organisers o join venues g on g.id = o.venue_id
    where o.kind = 'club'
      and (upper(replace(coalesce(g.postcode, ''), ' ', '')) = upper(replace(r.postcode, ' ', ''))
           or lower(btrim(o.name)) = lower(r.club) or lower(btrim(g.name)) = lower(r.club))
    order by (upper(replace(coalesce(g.postcode, ''), ' ', '')) = upper(replace(r.postcode, ' ', ''))) desc
    limit 1;
    if v is null then
      insert into venues (name, address, postcode) values (r.club, r.address, r.postcode) returning id into v;
      new_slug := btrim(regexp_replace(lower(replace(r.club, '&', 'and')), '[^a-z0-9]+', '-', 'g'), '-');
      if exists (select 1 from organisers o where o.slug = new_slug) then new_slug := new_slug || '-' || left(v::text, 4); end if;
      insert into organisers (name, short_name, kind, slug, venue_id) values (r.club, r.club, 'club', new_slug, v);
      club_short := r.club;
      raise notice 'New club: %', r.club;
    end if;

    insert into qualifier_events (competition_id, name, location, venue_id, final_date, results_depth, winner_person_id)
    values (comp, r.name, club_short, v, r.final_date, 'final', null)
    returning id into ev;

    select coalesce(max(place_number), 0) + 1 into next_place from qualifying_places where competition_id = comp;
    insert into qualifying_places (competition_id, place_number, source, source_label, qualifier_event_id)
    values (
      comp, next_place, 'winner_of',
      -- as the app writes it: "Winner · Fylde Classic · Kirkham · Sat 5 Jun"
      concat_ws(' · ', 'Winner', r.name, club_short,
                case when r.final_date is not null then to_char(r.final_date, 'Dy FMDD Mon') end),
      ev
    );
    added := added + 1;
  end loop;

  -- Plus at least 4 wildcards
  select count(*) into wildcards from qualifying_places where competition_id = comp and source = 'wildcard';
  while wildcards < 4 loop
    select coalesce(max(place_number), 0) + 1 into next_place from qualifying_places where competition_id = comp;
    insert into qualifying_places (competition_id, place_number, source, source_label)
    values (comp, next_place, 'wildcard', 'Wildcard');
    wildcards := wildcards + 1;
  end loop;

  raise notice 'Qualifying competitions added: %', added;
end $$;

commit;

select p.place_number, p.source_label, q.final_date, q.location, (q.venue_id is not null) as has_club
from qualifying_places p
join competitions c on c.id = p.competition_id
join series s on s.id = c.series_id
join organisers o on o.id = s.organiser_id
left join qualifier_events q on q.id = p.qualifier_event_id
where o.slug = 'blackpool-masters' and c.year = 2027 and c.entry_method = 'qualification'
order by p.place_number;
