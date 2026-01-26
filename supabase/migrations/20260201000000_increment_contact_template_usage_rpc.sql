-- Add RPC for contact template usage tracking (fixes 404 from useUserContactTemplates)
-- Used when a user applies a contact template in JSA/DVIR forms.

CREATE OR REPLACE FUNCTION public.increment_contact_template_usage(template_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_contact_templates
  SET
    use_count = COALESCE(use_count, 0) + 1,
    last_used_at = now(),
    updated_at = now()
  WHERE id = template_id
    AND user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.increment_contact_template_usage(UUID) IS
  'Increments use_count and last_used_at for a contact template; only affects rows owned by the caller.';
