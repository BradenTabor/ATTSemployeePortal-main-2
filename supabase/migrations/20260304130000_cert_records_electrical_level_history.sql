-- Store previous/new electrical level on certification_records for history display.
-- Used when certification_type is electrical-qualification.

ALTER TABLE public.certification_records
  ADD COLUMN IF NOT EXISTS previous_electrical_level text,
  ADD COLUMN IF NOT EXISTS new_electrical_level text;

COMMENT ON COLUMN public.certification_records.previous_electrical_level IS
  'Electrical qualification level before this change (electrical-qualification cert type only).';
COMMENT ON COLUMN public.certification_records.new_electrical_level IS
  'Electrical qualification level after this change (electrical-qualification cert type only).';
