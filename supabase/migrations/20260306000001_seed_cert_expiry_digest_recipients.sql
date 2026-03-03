-- Seed certification_expiry_digest recipients from compliance_summary (separate migration so enum value is committed).
INSERT INTO public.email_recipient_lists (list_key, email, created_at)
SELECT
  'certification_expiry_digest'::public.email_list_key,
  email,
  now()
FROM public.email_recipient_lists
WHERE list_key = 'compliance_summary'
ON CONFLICT (list_key, email) DO NOTHING;
