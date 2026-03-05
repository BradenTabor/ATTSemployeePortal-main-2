-- =============================================================================
-- Normalize app_users.phone_number to E.164 (e.g. '+1 870-280-9951' -> '+18702809951')
-- One-time update of existing rows; new sign-ups should store E.164 in app if possible.
-- =============================================================================

UPDATE public.app_users
SET phone_number = normalized.phone_e164
FROM (
  SELECT
    id,
    CASE
      WHEN digits.len = 10 THEN '+1' || digits.d
      WHEN digits.len = 11 AND left(digits.d, 1) = '1' THEN '+' || digits.d
      WHEN digits.len BETWEEN 7 AND 15 THEN '+' || digits.d
      ELSE NULL
    END AS phone_e164
  FROM (
    SELECT
      id,
      regexp_replace(trim(COALESCE(phone_number, '')), '\D', '', 'g') AS d,
      length(regexp_replace(trim(COALESCE(phone_number, '')), '\D', '', 'g')) AS len
    FROM public.app_users
    WHERE phone_number IS NOT NULL AND trim(phone_number) <> ''
  ) digits
  WHERE digits.len BETWEEN 7 AND 15
) normalized
WHERE public.app_users.id = normalized.id
  AND normalized.phone_e164 IS NOT NULL
  AND normalized.phone_e164 ~ '^\+[1-9]\d{6,14}$'
  AND (public.app_users.phone_number IS DISTINCT FROM normalized.phone_e164);

COMMENT ON COLUMN public.app_users.phone_number IS
  'User phone from sign-up; E.164 format preferred (e.g. +18702809951). Source: auth.users.raw_user_meta_data->>''phone_number''.';
