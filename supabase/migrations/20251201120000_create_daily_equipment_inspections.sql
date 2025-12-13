/*
  # Daily Equipment Inspection storage + table

  - Creates the `daily_equipment_inspections` table to persist submissions from
    `DailyEquipmentInspectionForm.tsx`. Stores metadata, checklist payloads, and
    Supabase Storage paths for every captured photo (including the new hydraulic
    fluid requirement).
  - Provisions a public storage bucket `equipment-inspection-photos` plus basic
    RLS policies so authenticated users can upload/delete their own images while
    everyone (including anon) can view them via public URLs.
*/

-- Create table -------------------------------------------------------------
create table if not exists public.daily_equipment_inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  equipment_type text not null,
  equipment_number text not null,
  inspection_date date not null,
  template text,
  notes text,

  general_checklist jsonb,
  specific_checklist jsonb,

  overview_photo_path text,
  damage_photo_path text,
  attachments_photo_path text,
  hydraulic_photo_path text not null,

  constraint general_checklist_is_object
    check (general_checklist is null or jsonb_typeof(general_checklist) = 'object'),
  constraint specific_checklist_is_object
    check (specific_checklist is null or jsonb_typeof(specific_checklist) = 'object')
);

comment on table public.daily_equipment_inspections is
  'Stores daily equipment inspection submissions, including checklist payloads and Supabase Storage paths.';

-- RLS + policies -----------------------------------------------------------
alter table public.daily_equipment_inspections enable row level security;

drop policy if exists "equipment_inspection_insert_own" on public.daily_equipment_inspections;
drop policy if exists "equipment_inspection_select_own" on public.daily_equipment_inspections;
drop policy if exists "equipment_inspection_admin_select" on public.daily_equipment_inspections;

create policy "equipment_inspection_insert_own"
  on public.daily_equipment_inspections
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "equipment_inspection_select_own"
  on public.daily_equipment_inspections
  for select
  to authenticated
  using (user_id = auth.uid());

-- Uses public.is_admin() helper function to avoid direct app_users queries
-- NOTE: Fixed bug where it used au.id instead of au.user_id
-- (prevents potential recursion issues)
create policy "equipment_inspection_admin_select"
  on public.daily_equipment_inspections
  for select
  to authenticated
  using (public.is_admin());

-- Storage bucket -----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('equipment-inspection-photos', 'equipment-inspection-photos', true)
on conflict (id) do nothing;

-- Storage policies (bucket already public for reads; keep explicit select perms)
drop policy if exists "equipment_photos_public_select" on storage.objects;
drop policy if exists "equipment_photos_owner_insert" on storage.objects;
drop policy if exists "equipment_photos_owner_update" on storage.objects;
drop policy if exists "equipment_photos_owner_delete" on storage.objects;

create policy "equipment_photos_public_select"
  on storage.objects
  for select
  to public
  using (bucket_id = 'equipment-inspection-photos');

create policy "equipment_photos_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'equipment-inspection-photos'
    and owner = auth.uid()
  );

create policy "equipment_photos_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'equipment-inspection-photos'
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'equipment-inspection-photos'
    and owner = auth.uid()
  );

create policy "equipment_photos_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'equipment-inspection-photos'
    and owner = auth.uid()
  );

