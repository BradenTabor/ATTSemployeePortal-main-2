-- Add electrical hazard data to daily_jsa (OSHA 1910.269)
ALTER TABLE public.daily_jsa
  ADD COLUMN IF NOT EXISTS electrical_hazard_data JSONB;

COMMENT ON COLUMN public.daily_jsa.electrical_hazard_data IS 'OSHA 1910.269 electrical safety data. Required when electrical hazards identified.';
