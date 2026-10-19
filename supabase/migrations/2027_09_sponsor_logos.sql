-- 2027 multi-competition site - part 9: sponsor logos
-- Run AFTER parts 1 to 8, on the TEST project first.
--
-- Each sponsor can have a logo, uploaded in the competition's set-up form.
-- Logos are kept in a public storage folder ("sponsor-logos") that anyone can
-- view and only Super can add to or change. The Verve Wills logo already
-- built into the site is linked to its October Singles 2026 sponsor row, so
-- that competition looks the same as before.
--
-- Wrapped in a transaction: if any step fails, nothing is kept.

begin;

alter table competition_sponsors add column logo_url text;

-- The folder for logos: public to view, images only, up to 2 MB each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sponsor-logos',
  'sponsor-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do nothing;

create policy "super uploads sponsor logos" on storage.objects for insert
  with check (bucket_id = 'sponsor-logos' and is_super());
create policy "super changes sponsor logos" on storage.objects for update
  using (bucket_id = 'sponsor-logos' and is_super()) with check (bucket_id = 'sponsor-logos' and is_super());
create policy "super removes sponsor logos" on storage.objects for delete
  using (bucket_id = 'sponsor-logos' and is_super());

-- Verve Wills: the logo the site already has
update competition_sponsors
set logo_url = '/verve-wills-logo.png'
where name ilike 'Verve Wills%' and logo_url is null;

commit;
