/*
  # Add Employee Identity and Driver's License Fields

  ## Changes Made
  
  1. **New Columns in `app_users` table**
     - `email` (text) - Employee email address synced from auth.users
     - `full_name` (text) - Employee full name from raw_user_meta_data
     - `drivers_license_number` (text) - Driver's license number
     - `drivers_license_class` (text) - Driver's license class/type
     - `drivers_license_expiration` (text) - Driver's license expiration date
  
  2. **Updated Trigger Function**
     - `handle_new_user()` now extracts and syncs identity fields from:
       - `auth.users.email`
       - `auth.users.raw_user_meta_data` (full_name, DL details)
     - Uses upsert pattern (on conflict do update) for idempotency
  
  3. **Trigger Setup**
     - Drops existing `on_auth_user_created` trigger if present
     - Creates new trigger on `auth.users` after insert
     - Automatically populates `app_users` with employee identity data

  ## Important Notes
  - All column additions use IF NOT EXISTS for safe re-runs
  - Trigger function uses SECURITY DEFINER for proper permissions
  - Uses coalesce() to handle null values gracefully
  - Does not modify `user_profiles` view (must be updated separately)
*/

-- Add new columns to app_users table
alter table public.app_users
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists drivers_license_number text,
  add column if not exists drivers_license_class text,
  add column if not exists drivers_license_expiration text;

-- Create or replace trigger function to sync auth.users to app_users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_full_name text;
  v_dl_number text;
  v_dl_class text;
  v_dl_exp text;
begin
  -- Extract metadata fields
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_dl_number := new.raw_user_meta_data->>'drivers_license_number';
  v_dl_class  := new.raw_user_meta_data->>'drivers_license_class';
  v_dl_exp    := new.raw_user_meta_data->>'drivers_license_expiration';

  -- Upsert into app_users
  insert into public.app_users (
    id,
    email,
    full_name,
    drivers_license_number,
    drivers_license_class,
    drivers_license_expiration
  )
  values (
    new.id,
    new.email,
    v_full_name,
    v_dl_number,
    v_dl_class,
    v_dl_exp
  )
  on conflict (id) do update
    set email                      = excluded.email,
        full_name                  = excluded.full_name,
        drivers_license_number     = excluded.drivers_license_number,
        drivers_license_class      = excluded.drivers_license_class,
        drivers_license_expiration = excluded.drivers_license_expiration;

  return new;
end;
$$ language plpgsql security definer;

-- Drop existing trigger if present
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger on auth.users
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();