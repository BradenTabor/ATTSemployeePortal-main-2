-- Add verification_code to certification_records for public certificate verification.
-- 8-character alphanumeric, unique, generated at insert time in Postgres.

-- Function: 8-char random alphanumeric (0-9, A-Z, a-z)
CREATE OR REPLACE FUNCTION public.generate_certification_verification_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT string_agg(
    substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (random() * 62)::int + 1, 1),
    ''
  )
  FROM generate_series(1, 8);
$$;

COMMENT ON FUNCTION public.generate_certification_verification_code() IS
  'Returns an 8-character random alphanumeric string for certification_records.verification_code.';

-- Add column (nullable first for backfill)
ALTER TABLE public.certification_records
  ADD COLUMN IF NOT EXISTS verification_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certification_records_verification_code
  ON public.certification_records(verification_code)
  WHERE verification_code IS NOT NULL;

-- Backfill existing rows with unique codes (retry on collision)
DO $$
DECLARE
  r record;
  c text;
BEGIN
  FOR r IN SELECT id FROM public.certification_records WHERE verification_code IS NULL
  LOOP
    LOOP
      c := public.generate_certification_verification_code();
      BEGIN
        UPDATE public.certification_records SET verification_code = c WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        NULL; -- retry with new code
      END;
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE public.certification_records
  ALTER COLUMN verification_code SET NOT NULL,
  ALTER COLUMN verification_code SET DEFAULT public.generate_certification_verification_code();

COMMENT ON COLUMN public.certification_records.verification_code IS
  'Public 8-char code for verification at /verify/:code. Unique, generated at insert.';

-- RPC for public lookup: returns only name and cert info (no PII beyond name). Callable by anon.
CREATE OR REPLACE FUNCTION public.get_certificate_by_verification_code(p_code text)
RETURNS TABLE (
  full_name text,
  certification_name text,
  certified_at timestamptz,
  expires_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.full_name,
    ct.name,
    cr.certified_at,
    cr.expires_at,
    cr.status
  FROM public.certification_records cr
  JOIN public.app_users au ON au.user_id = cr.user_id
  JOIN public.certification_types ct ON ct.id = cr.certification_type_id
  WHERE cr.verification_code = p_code
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_certificate_by_verification_code(text) IS
  'Public lookup for /verify/:code. Returns worker name, cert name, dates, status. No auth required.';

GRANT EXECUTE ON FUNCTION public.get_certificate_by_verification_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_certificate_by_verification_code(text) TO authenticated;
