-- MetaLink Logistique: driver profile photo storage
-- Review and run once in Supabase SQL Editor.
-- Public read is intentional because driver photos appear on public truck listings.
-- Upload/update/delete is restricted to the authenticated user's own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('driver-photos', 'driver-photos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "MetaLink driver photos public read" on storage.objects;
create policy "MetaLink driver photos public read"
on storage.objects for select
to public
using (bucket_id = 'driver-photos');

drop policy if exists "MetaLink drivers upload own photos" on storage.objects;
create policy "MetaLink drivers upload own photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'driver-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MetaLink drivers update own photos" on storage.objects;
create policy "MetaLink drivers update own photos"
on storage.objects for update
to authenticated
using (bucket_id = 'driver-photos' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'driver-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "MetaLink drivers delete own photos" on storage.objects;
create policy "MetaLink drivers delete own photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'driver-photos' and (storage.foldername(name))[1] = auth.uid()::text);
