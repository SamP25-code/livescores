-- 2027 multi-competition site - part 8: a maps link for each venue
-- Run AFTER parts 1 to 7, on the TEST project first.
--
-- "Get directions" opens Google Maps searching the venue's address. For a
-- green that a search doesn't find exactly (behind a pub, a car park round
-- the back), a Google Maps link to the exact spot can be pasted in instead,
-- and directions use that.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

alter table venues add column map_url text
  check (map_url is null or map_url ~ '^https://');

commit;
