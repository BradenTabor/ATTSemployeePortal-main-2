-- Reproducible safety-form storage, including UPDATE needed for offline retry
-- upserts. Existing bucket visibility/settings are deliberately preserved.
insert into storage.buckets (id, name, public)
values ('dvir-photos', 'dvir-photos', true),
       ('equipment-inspection-photos', 'equipment-inspection-photos', true),
       ('jsa-photos', 'jsa-photos', false)
on conflict (id) do nothing;

drop policy if exists safety_form_photos_read on storage.objects;
create policy safety_form_photos_read on storage.objects for select to authenticated
using (bucket_id in ('dvir-photos', 'equipment-inspection-photos', 'jsa-photos'));

drop policy if exists safety_form_photos_insert_own on storage.objects;
create policy safety_form_photos_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id in ('dvir-photos', 'equipment-inspection-photos', 'jsa-photos')
  and ((storage.foldername(name))[1] = (select auth.uid())::text
    or (bucket_id = 'dvir-photos' and (storage.foldername(name))[1] = 'dvir-photos'
      and (storage.foldername(name))[2] = (select auth.uid())::text))
);

drop policy if exists safety_form_photos_update_own on storage.objects;
create policy safety_form_photos_update_own on storage.objects for update to authenticated
using (
  bucket_id in ('dvir-photos', 'equipment-inspection-photos', 'jsa-photos')
  and ((storage.foldername(name))[1] = (select auth.uid())::text
    or (bucket_id = 'dvir-photos' and (storage.foldername(name))[1] = 'dvir-photos'
      and (storage.foldername(name))[2] = (select auth.uid())::text))
)
with check (
  bucket_id in ('dvir-photos', 'equipment-inspection-photos', 'jsa-photos')
  and ((storage.foldername(name))[1] = (select auth.uid())::text
    or (bucket_id = 'dvir-photos' and (storage.foldername(name))[1] = 'dvir-photos'
      and (storage.foldername(name))[2] = (select auth.uid())::text))
);

drop policy if exists safety_form_photos_delete_own on storage.objects;
create policy safety_form_photos_delete_own on storage.objects for delete to authenticated
using (
  bucket_id in ('dvir-photos', 'equipment-inspection-photos', 'jsa-photos')
  and ((storage.foldername(name))[1] = (select auth.uid())::text
    or (bucket_id = 'dvir-photos' and (storage.foldername(name))[1] = 'dvir-photos'
      and (storage.foldername(name))[2] = (select auth.uid())::text))
);
