-- A venue can also be a club (Marton Institute): the club's home green.
-- A club listed this way shows on the Clubs page even before it runs a
-- competition of its own, with the competitions played on its green.
alter table organisers add column if not exists venue_id uuid references venues(id) on delete set null;
create unique index if not exists organisers_venue_id_key on organisers (venue_id) where venue_id is not null;
