-- 2027 multi-competition site - part 7: admins can correct their players' details
-- Run AFTER parts 1 to 6, on the TEST project first.
--
-- A person's name, club and note could only be changed by Super, because each
-- person is shared by every competition they play in. Now a competition's
-- admin can correct them too - but only someone entered solely in competitions
-- that admin runs (or not entered in anything yet), so nobody can rename a
-- player who's also in another club's competition. Merging and hiding people
-- stay Super only.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

-- Super, or an admin who runs every competition this person is entered in
create or replace function can_change_person(person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_super() or (
    is_any_admin() and not exists (
      select 1 from entries e
      where (e.person_id = person or e.partner_id = person)
        and not can_admin(e.competition_id)
    )
  );
$$;

drop policy if exists "super change people" on people;
create policy "admins change their own people" on people for update
  using (can_change_person(id)) with check (can_change_person(id));

-- Merging and hiding stay with Super, whoever else can edit the row
create or replace function people_guard() returns trigger
language plpgsql as $$
begin
  if not is_super()
     and (new.merged_into_id is distinct from old.merged_into_id or new.hidden is distinct from old.hidden) then
    raise exception 'Only Super can merge or hide people';
  end if;
  return new;
end;
$$;

create trigger people_guard
before update on people
for each row execute function people_guard();

commit;
