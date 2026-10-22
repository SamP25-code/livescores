-- Backgrounds: a general one for the whole site, chosen in admin, and an
-- optional one for each competition and each event (organisers already have
-- background_image). Pictures go in a public "backgrounds" folder that anyone
-- can view and only Super can add to or change.

begin;

alter table competitions add column if not exists background_url text;

-- Site-wide settings (just the background for now): anyone can read them,
-- only Super changes them
create table if not exists site_settings (
  key text primary key,
  value text
);
alter table site_settings enable row level security;
drop policy if exists "public read site settings" on site_settings;
create policy "public read site settings" on site_settings for select using (true);
drop policy if exists "super write site settings" on site_settings;
create policy "super write site settings" on site_settings for all using (is_super()) with check (is_super());

-- The folder for backgrounds: public to view, pictures only, up to 8 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "super uploads backgrounds" on storage.objects;
create policy "super uploads backgrounds" on storage.objects for insert
  with check (bucket_id = 'backgrounds' and is_super());
drop policy if exists "super changes backgrounds" on storage.objects;
create policy "super changes backgrounds" on storage.objects for update
  using (bucket_id = 'backgrounds' and is_super()) with check (bucket_id = 'backgrounds' and is_super());
drop policy if exists "super removes backgrounds" on storage.objects;
create policy "super removes backgrounds" on storage.objects for delete
  using (bucket_id = 'backgrounds' and is_super());

commit;
