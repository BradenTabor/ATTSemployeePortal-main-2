-- Backfill app_users.phone_number from auth.users.raw_user_meta_data for existing users.
-- Run once so users who signed up with a phone (or had it set in auth) get it in app_users for mass SMS.

UPDATE public.app_users au
SET phone_number = trim(au_meta.phone)
FROM (
  SELECT
    u.id AS user_id,
    (u.raw_user_meta_data->>'phone_number') AS phone
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'phone_number' IS NOT NULL
    AND trim(u.raw_user_meta_data->>'phone_number') <> ''
) au_meta
WHERE au.user_id = au_meta.user_id
  AND (au.phone_number IS NULL OR trim(au.phone_number) = '');
