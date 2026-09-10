-- =============================================================================
-- Resolve user_id for pre-cutover legacy SMS rows in sms_message_log_compat
-- by matching normalized phone on app_users.phone_number. Live sms_message_log
-- rows keep their stored user_id (first branch unchanged).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.normalize_phone_to_e164(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN digits IS NULL OR length(digits) < 10 THEN NULL
    WHEN left(digits, 1) = '1' AND length(digits) = 11 THEN '+' || digits
    ELSE '+1' || digits
  END
  FROM (
    SELECT NULLIF(regexp_replace(trim(COALESCE(p_phone, '')), '\D', '', 'g'), '') AS digits
  ) x;
$$;

COMMENT ON FUNCTION public.normalize_phone_to_e164(text) IS
  'Normalize a phone string to US E.164 (+1...) matching Edge Function toE164(). Returns NULL when invalid.';

CREATE OR REPLACE VIEW public.sms_message_log_compat
WITH (security_invoker = true) AS
SELECT
  l.id,
  l.user_id,
  l.phone_e164,
  l.message_type,
  l.category,
  l.from_number,
  l.body,
  l.template_key,
  l.provider_message_id,
  l.provider_status,
  l.price,
  l.opt_out_state_at_send,
  l.run_id,
  l.source_table,
  l.is_dry_run,
  l.sent_at,
  l.created_at,
  l.updated_at
FROM public.sms_message_log l

UNION ALL

SELECT
  public.sms_compat_uuid(esc.id::text || ':esc:' || ord.ordinality::text) AS id,
  au_esc.user_id AS user_id,
  NULLIF(ord.m->>'to', '') AS phone_e164,
  CASE esc.tier
    WHEN 0 THEN 'safety_briefing_reminder'
    WHEN 1 THEN 'safety_briefing_escalation_t1'
    WHEN 2 THEN 'safety_briefing_escalation_t2'
    ELSE 'safety_briefing_escalation'
  END AS message_type,
  'operational'::text AS category,
  NULL::text AS from_number,
  NULL::text AS body,
  NULL::text AS template_key,
  COALESCE(ord.m->>'messageId', ord.m->>'message_id') AS provider_message_id,
  ord.m->>'status' AS provider_status,
  NULLIF(COALESCE(ord.m->>'price', ord.m->>'message_price'), '')::numeric AS price,
  NULL::jsonb AS opt_out_state_at_send,
  esc.id AS run_id,
  'sms_escalation_send_log'::text AS source_table,
  false AS is_dry_run,
  esc.sent_at,
  esc.sent_at AS created_at,
  esc.sent_at AS updated_at
FROM public.sms_escalation_send_log esc
CROSS JOIN LATERAL jsonb_array_elements(esc.results) WITH ORDINALITY AS ord(m, ordinality)
LEFT JOIN public.app_users au_esc
  ON public.normalize_phone_to_e164(au_esc.phone_number)
   = public.normalize_phone_to_e164(NULLIF(ord.m->>'to', ''))
WHERE jsonb_typeof(esc.results) = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sms_message_log n
    WHERE n.run_id = esc.id
      AND n.source_table = 'sms_escalation_send_log'
      AND n.is_dry_run = false
  )

UNION ALL

SELECT
  public.sms_compat_uuid(pay.id::text || ':pay:' || ord.ordinality::text) AS id,
  au_pay.user_id AS user_id,
  NULLIF(ord.m->>'to', '') AS phone_e164,
  'payroll_reminder'::text AS message_type,
  'operational'::text AS category,
  NULL::text AS from_number,
  NULL::text AS body,
  NULL::text AS template_key,
  COALESCE(ord.m->>'messageId', ord.m->>'message_id') AS provider_message_id,
  ord.m->>'status' AS provider_status,
  NULLIF(COALESCE(ord.m->>'price', ord.m->>'message_price'), '')::numeric AS price,
  NULL::jsonb AS opt_out_state_at_send,
  pay.id AS run_id,
  'payroll_reminder_sms_log'::text AS source_table,
  false AS is_dry_run,
  pay.sent_at,
  pay.sent_at AS created_at,
  pay.sent_at AS updated_at
FROM public.payroll_reminder_sms_log pay
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pay.results->'clicksend_results', '[]'::jsonb))
  WITH ORDINALITY AS ord(m, ordinality)
LEFT JOIN public.app_users au_pay
  ON public.normalize_phone_to_e164(au_pay.phone_number)
   = public.normalize_phone_to_e164(NULLIF(ord.m->>'to', ''))
WHERE jsonb_typeof(pay.results) = 'object'
  AND jsonb_typeof(pay.results->'clicksend_results') = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sms_message_log n
    WHERE n.run_id = pay.id
      AND n.source_table = 'payroll_reminder_sms_log'
      AND n.is_dry_run = false
  )

UNION ALL

SELECT
  public.sms_compat_uuid(ms.id::text || ':mass') AS id,
  NULL::uuid AS user_id,
  NULL::text AS phone_e164,
  'mass_sms'::text AS message_type,
  'marketing'::text AS category,
  NULL::text AS from_number,
  ms.message_preview AS body,
  NULL::text AS template_key,
  NULL::text AS provider_message_id,
  ms.status AS provider_status,
  ms.total_price AS price,
  NULL::jsonb AS opt_out_state_at_send,
  ms.id AS run_id,
  'mass_sms_log'::text AS source_table,
  false AS is_dry_run,
  ms.created_at AS sent_at,
  ms.created_at,
  ms.created_at AS updated_at
FROM public.mass_sms_log ms
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sms_message_log n
  WHERE n.run_id = ms.id
    AND n.source_table = 'mass_sms_log'
    AND n.is_dry_run = false
);

COMMENT ON VIEW public.sms_message_log_compat IS
  'sms_message_log plus unnested pre-cutover rows from legacy log tables. Escalation/payroll rows resolve user_id via normalized phone on app_users. Mass history is run-level (no per-recipient data).';
