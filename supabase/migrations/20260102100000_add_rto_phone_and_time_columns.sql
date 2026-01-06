/*
  ============================================================================
  ADD PHONE NUMBER AND TIME COLUMNS TO RTO_REQUESTS
  ============================================================================
  
  This migration adds missing columns to the rto_requests table:
  
  1. phone_number (text) - Employee's contact phone number
  2. start_time (text) - Time coverage begins (HH:MM format)
  3. end_time (text) - Time coverage ends (HH:MM format)
  4. total_duration (text) - Calculated total duration string
  
  These fields are used by the RequestTimeOff form to capture more detailed
  time-off information.
  
  ============================================================================
*/

-- Add phone_number column
ALTER TABLE public.rto_requests 
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add start_time column (stored as text in HH:MM format)
ALTER TABLE public.rto_requests 
  ADD COLUMN IF NOT EXISTS start_time TEXT;

-- Add end_time column (stored as text in HH:MM format)
ALTER TABLE public.rto_requests 
  ADD COLUMN IF NOT EXISTS end_time TEXT;

-- Add total_duration column (stores calculated duration string like "2 days · 16h 0m")
ALTER TABLE public.rto_requests 
  ADD COLUMN IF NOT EXISTS total_duration TEXT;

-- Add a comment documenting the columns
COMMENT ON COLUMN public.rto_requests.phone_number IS 'Employee contact phone number for RTO requests';
COMMENT ON COLUMN public.rto_requests.start_time IS 'Time coverage begins, stored as HH:MM text';
COMMENT ON COLUMN public.rto_requests.end_time IS 'Time coverage ends, stored as HH:MM text';
COMMENT ON COLUMN public.rto_requests.total_duration IS 'Calculated duration string (e.g., "2 days · 16h 0m")';


