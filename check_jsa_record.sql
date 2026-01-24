-- Check the specific failing JSA record
SELECT 
  id,
  observer_signatures,
  pg_typeof(observer_signatures) as column_type,
  jsonb_array_length(observer_signatures) as array_length,
  created_at,
  updated_at,
  status
FROM public.daily_jsa 
WHERE id = '7658b1de-6b8c-49b9-a5f8-40c024a0387f';
