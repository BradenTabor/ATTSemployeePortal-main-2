/*
  # Add Avatar URL to App Users

  ## Overview
  This migration adds support for user profile photos/avatars.
  
  ## Changes
  1. Adds `avatar_url` column to `app_users` table
  2. Creates index for efficient querying of users with/without avatars
  
  ## Storage
  Avatar images are stored in the `avatars` Supabase Storage bucket.
  Path format: {user_id}/{timestamp}.jpeg
  
  ## Notes
  - Column is nullable (users don't need to have an avatar)
  - JPEG format used for maximum browser compatibility
*/

-- Add avatar_url column to app_users
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.app_users.avatar_url IS 
  'Path to user avatar in Supabase Storage (avatars bucket). Format: {user_id}/{timestamp}.jpeg';

-- Add index for potential future queries filtering by avatar presence
CREATE INDEX IF NOT EXISTS idx_app_users_has_avatar 
ON public.app_users ((avatar_url IS NOT NULL));
