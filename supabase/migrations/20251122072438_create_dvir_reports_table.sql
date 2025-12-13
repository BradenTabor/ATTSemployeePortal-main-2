/*
  # Create DVIR Reports Table

  ## Overview
  Creates the `dvir_reports` table to store Daily Vehicle Inspection Reports (DVIR)
  submitted by drivers through the DVIRForm.tsx frontend component.

  ## New Tables
  
  ### `dvir_reports`
  Stores complete DVIR submissions with:
  - **Vehicle/Driver Information** - truck number, mileage, driver details, license info
  - **Equipment Details** - chipper, trailer, GVWR ratings
  - **Medical/License Compliance** - medical card status, license class and expiration
  - **Inspection Checklists** - vehicle/trailer and aerial lift checklists (JSONB)
  - **Notes** - general notes and aerial-specific notes
  - **Signatures** - paths to signature images in storage (driver, foreman, mechanic)
  - **Photos** - paths to inspection photos in storage (oil, tires, coolant, damage, cleanliness)
  - **Mechanic Section** - deficiency corrections, mechanic remarks and signatures

  ## Columns
  - `id` (uuid, primary key) - Unique report identifier
  - `user_id` (uuid, FK to auth.users) - Employee who submitted the report
  - `created_at` (timestamptz) - Submission timestamp
  - Section A fields (truck_number, mileage, driver info, license details)
  - Checklist fields (vehicle_trailer_checklist, aerial_checklist as JSONB)
  - Signature paths (final_driver_signature, general_foreman_signature, etc.)
  - Photo paths (oil_dipstick_path, tire_photo_path, coolant_photo_path, etc.)
  - Mechanic section fields (mechanic_truck_number, deficiency_corrected, etc.)

  ## Security
  - Enable RLS on `dvir_reports` table
  - Policy: Authenticated users can INSERT their own reports
  - Policy: Users can SELECT only their own reports
  - Policy: Admins can SELECT all reports

  ## Storage
  - Expects "dvir-photos" bucket to exist (created separately if needed)
  - All photo and signature paths reference files in that bucket

  ## Important Notes
  - Uses `text` for date fields (drivers_license_exp, medical_card_exp, mechanic_date) 
    because frontend uses free-form MM/DD/YYYY format
  - Checklists stored as JSONB for flexibility
  - Foreign key to auth.users uses ON DELETE SET NULL to preserve reports if user deleted
*/

-- Create dvir_reports table
create table if not exists public.dvir_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- Section A – vehicle / driver info
  truck_number text not null,
  mileage numeric not null,
  chipper_number text,
  trailer_number text,
  truck_gvwr text,
  trailer_chipper_gvwr text,
  medical_card_required text,
  drivers_name text not null,
  drivers_license_number text,
  drivers_license_class text,
  drivers_license_exp text,
  drivers_license_required text,
  has_medical_card text,
  medical_card_exp text,
  copy_of_registration text,
  copy_of_insurance text,
  drivers_signature_section_a text,

  -- Vehicle / trailer checklist (from JS objects)
  vehicle_trailer_checklist jsonb,
  notes text,

  -- Aerial lift
  aerial_checklist jsonb,
  aerial_notes text,

  -- Final sign-offs – paths to signature images in "dvir-photos"
  final_driver_signature text,
  general_foreman_signature text,

  -- Mechanic section
  mechanic_truck_number text,
  mechanic_date text,
  deficiency_corrected text,
  mechanic_remarks text,
  mechanic_signature text,
  driver_approval_signature text,

  -- Photo paths (stored in Supabase Storage "dvir-photos")
  oil_dipstick_path text not null,
  tire_photo_path text,
  coolant_photo_path text,
  damage_photo_path text,
  detail_clean_truck_photo_path text
);

-- Enable RLS
alter table public.dvir_reports enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "dvir_insert_own" on public.dvir_reports;
drop policy if exists "dvir_select_own" on public.dvir_reports;
drop policy if exists "dvir_admin_select_all" on public.dvir_reports;

-- Policy: Users can insert their own reports
create policy "dvir_insert_own"
  on public.dvir_reports
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Policy: Users can select only their own reports
create policy "dvir_select_own"
  on public.dvir_reports
  for select
  to authenticated
  using (user_id = auth.uid());

-- Policy: Admins can select all reports
-- Uses public.is_admin() helper function to avoid direct app_users queries
-- NOTE: Fixed bug where it used au.id instead of au.user_id
-- (prevents potential recursion issues)
create policy "dvir_admin_select_all"
  on public.dvir_reports
  for select
  to authenticated
  using (public.is_admin());