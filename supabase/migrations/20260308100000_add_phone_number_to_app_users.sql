-- Add phone_number to app_users and update handle_new_user() to sync from auth sign-up metadata.
-- Rollback: ALTER TABLE public.app_users DROP COLUMN IF EXISTS phone_number; then re-deploy handle_new_user() from 20251223000001_schema_consolidation.sql

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS phone_number text;

COMMENT ON COLUMN public.app_users.phone_number IS
  'User phone from sign-up; source: auth.users.raw_user_meta_data->>''phone_number''. Keep key in sync with frontend signUp options.data.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name text;
  v_dl_number text;
  v_dl_class text;
  v_dl_exp text;
  v_phone text;
BEGIN
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
  v_dl_number := new.raw_user_meta_data->>'drivers_license_number';
  v_dl_class  := new.raw_user_meta_data->>'drivers_license_class';
  v_dl_exp    := new.raw_user_meta_data->>'drivers_license_expiration';
  v_phone     := new.raw_user_meta_data->>'phone_number';

  INSERT INTO public.app_users (
    user_id,
    email,
    full_name,
    drivers_license_number,
    drivers_license_class,
    drivers_license_expiration,
    phone_number,
    role
  )
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_dl_number,
    v_dl_class,
    v_dl_exp,
    v_phone,
    'employee'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.app_users.full_name),
    drivers_license_number = COALESCE(EXCLUDED.drivers_license_number, public.app_users.drivers_license_number),
    drivers_license_class = COALESCE(EXCLUDED.drivers_license_class, public.app_users.drivers_license_class),
    drivers_license_expiration = COALESCE(EXCLUDED.drivers_license_expiration, public.app_users.drivers_license_expiration),
    phone_number = COALESCE(EXCLUDED.phone_number, public.app_users.phone_number);

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Trigger function that creates/updates app_users record when a new auth.users record is created. Uses user_id column correctly. Syncs phone_number from raw_user_meta_data.';
