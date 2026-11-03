-- 2027 multi-competition site - part 22: prize money
-- Run AFTER parts 1 to 21, on the TEST project first.
--
-- A competition's prize money, shown on its page: a list of places and
-- amounts in the order shown, e.g. [{"place": "Winner", "amount": 200},
-- {"place": "Runner-up", "amount": 100}], plus an optional line of anything
-- else ("Depends on entries", "Plus trophies"). Both optional - often not
-- known when a competition is first set up, so Super adds them later.
-- Covered by the existing "super write competitions" policy.

begin;

alter table competitions add column if not exists prizes jsonb;
alter table competitions add column if not exists prize_note text;

commit;
