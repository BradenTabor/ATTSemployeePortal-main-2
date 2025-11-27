/*
  # Enable Realtime for app_users Table

  ## Overview
  This migration enables Supabase Realtime for the app_users table,
  allowing the Admin User Management page to receive live updates when
  user roles are added, updated, or deleted.

  ## Changes
  1. Add app_users table to supabase_realtime publication
     - Enables INSERT, UPDATE, DELETE event broadcasts
     - Allows admin pages to subscribe to real-time changes
     - No impact on authentication or RLS policies

  ## Security
  - Realtime respects existing Row Level Security (RLS) policies
  - Only authenticated users with proper permissions receive updates
  - Does not expose data to unauthorized users
  - Subscription requires valid JWT token

  ## Important Notes
  - Does not modify authentication flow
  - Does not change signup/login behavior
  - Only enables real-time event broadcasting
  - Client-side subscription already implemented
*/

-- Enable realtime replication for the app_users table
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_users;
