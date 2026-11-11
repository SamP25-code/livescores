-- 2027 multi-competition site - part 25: a photo on a qualifier's results
-- Run AFTER part 20, on the TEST project first. Safe to run more than once.
--
-- A qualifying competition not run on this site can have a photo (the
-- winner with the trophy), shown under its results. It's uploaded on the
-- qualifier's "Results" form into the "event-images" folder, which until now
-- only Super could upload to; a competition's admins (who enter qualifier
-- results) can now upload there too.

begin;

alter table qualifier_events add column if not exists photo_url text;

drop policy if exists "admins upload event images" on storage.objects;
create policy "admins upload event images" on storage.objects for insert
  with check (
    bucket_id = 'event-images'
    and exists (select 1 from assignments a where a.user_id = auth.uid() and a.role = 'admin')
  );

commit;
