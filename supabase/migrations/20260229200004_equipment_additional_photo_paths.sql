-- Phase 2: Optional multiple photos per inspection (batch upload)
ALTER TABLE public.daily_equipment_inspections
  ADD COLUMN IF NOT EXISTS additional_photo_paths text[] DEFAULT NULL;

COMMENT ON COLUMN public.daily_equipment_inspections.additional_photo_paths IS
  'Optional array of storage paths for extra photos (Phase 2 batch upload).';
