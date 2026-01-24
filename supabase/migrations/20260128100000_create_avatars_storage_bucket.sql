/*
  # Create avatars storage bucket

  Profile photos are stored in the `avatars` bucket. This migration ensures
  the bucket exists, is public for reads, and has RLS policies for upload/delete.

  Path format: {user_id}/{timestamp}.jpeg
*/

-- Storage bucket (public reads so avatar URLs work in img src without auth)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Policies
drop policy if exists "avatars_public_select" on storage.objects;
drop policy if exists "avatars_authenticated_insert" on storage.objects;
drop policy if exists "avatars_authenticated_update" on storage.objects;
drop policy if exists "avatars_authenticated_delete" on storage.objects;

create policy "avatars_public_select"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_authenticated_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_authenticated_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_authenticated_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
