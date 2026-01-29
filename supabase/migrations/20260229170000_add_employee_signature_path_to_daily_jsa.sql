/*
  Add employee_signature_path to daily_jsa (Image Signature Capture - Phase 1)
  When set, the employee signature is stored as an image in Supabase Storage (bucket: signatures).
  Falls back to employee_signature (text) when path is null.
*/

ALTER TABLE public.daily_jsa
  ADD COLUMN IF NOT EXISTS employee_signature_path text;

COMMENT ON COLUMN public.daily_jsa.employee_signature_path IS
  'Storage path for canvas signature image (signatures/{userId}/jsa/{timestamp}.png). When set, display image; else use employee_signature text.';
