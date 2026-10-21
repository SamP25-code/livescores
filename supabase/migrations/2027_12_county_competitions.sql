-- County competitions (NL&F County): a third kind of organiser beside clubs
-- and events. A county's competitions move between clubs, so each session
-- has its own venue (nights.venue_id, already there) rather than one for
-- the whole competition.
alter table organisers drop constraint if exists organisers_kind_check;
alter table organisers add constraint organisers_kind_check check (kind in ('club', 'event', 'county'));
