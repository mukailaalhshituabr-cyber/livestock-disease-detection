-- ============================================================
-- SUPABASE STORAGE SETUP for livestock images
-- Run AFTER schema.sql
--
-- Safe to re-run: policies are dropped and recreated, and the bucket
-- insert is a no-op if it already exists. This does NOT delete any
-- images already uploaded to the bucket.
-- ============================================================

-- 1. Create the bucket (can also be done in Dashboard -> Storage -> New Bucket)
insert into storage.buckets (id, name, public)
values ('livestock-images', 'livestock-images', true)
on conflict (id) do nothing;

-- 2. Only allow a user to upload into their OWN folder: {user_id}/filename.jpg
drop policy if exists "Users can upload their own livestock images" on storage.objects;
create policy "Users can upload their own livestock images"
on storage.objects for insert
with check (
  bucket_id = 'livestock-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Anyone can view images (bucket is public - needed so the app can
--    display images via a public URL). Restrict this further if you
--    later decide images should be private.
drop policy if exists "Anyone can view livestock images" on storage.objects;
create policy "Anyone can view livestock images"
on storage.objects for select
using (bucket_id = 'livestock-images');

-- 4. Users can only delete their own images
drop policy if exists "Users can delete their own livestock images" on storage.objects;
create policy "Users can delete their own livestock images"
on storage.objects for delete
using (
  bucket_id = 'livestock-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

