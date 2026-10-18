-- 2027 multi-competition site - part 4: merging two records of the same person
-- Run AFTER parts 1 to 3, on the TEST project first.
--
-- When two records turn out to be the same person (e.g. "W Ditchfield" and
-- "Wayne Ditchfield"), Super merges them: every entry and honour moves to the
-- kept record, and the other is marked as merged into it (not deleted, so the
-- change can be traced). Results follow automatically, because a player's place
-- in a draw points at the entry, not the person.
--
-- One function, so the merge happens completely or not at all. If both records
-- are entered in the same competition, the entries check refuses it and
-- nothing changes.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

create or replace function merge_people(remove_id uuid, keep_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  removed_name text;
  kept_name text;
begin
  if not is_super() then
    raise exception 'Only Super can merge people';
  end if;
  if remove_id = keep_id then
    raise exception 'Choose two different people to merge';
  end if;

  select full_name into removed_name from people where id = remove_id and merged_into_id is null;
  select full_name into kept_name from people where id = keep_id and merged_into_id is null;
  if removed_name is null or kept_name is null then
    raise exception 'One of those people has already been merged';
  end if;

  update entries set person_id = keep_id where person_id = remove_id;
  update entries set partner_id = keep_id where partner_id = remove_id;
  update honours_history set winner_person_id = keep_id where winner_person_id = remove_id;
  update honours_history set runner_up_person_id = keep_id where runner_up_person_id = remove_id;
  update people set merged_into_id = keep_id where merged_into_id = remove_id;
  update people set merged_into_id = keep_id where id = remove_id;

  insert into audit_log (competition_id, action, details)
  values (null, 'people_merged', jsonb_build_object(
    'removed_id', remove_id, 'removed_name', removed_name,
    'kept_id', keep_id, 'kept_name', kept_name
  ));
end;
$$;

revoke all on function merge_people(uuid, uuid) from public, anon;
grant execute on function merge_people(uuid, uuid) to authenticated;

commit;
