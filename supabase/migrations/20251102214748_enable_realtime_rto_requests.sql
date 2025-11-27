/*
  # Enable Realtime for rto_requests Table

  ## Overview
  This migration enables Supabase Realtime for the rto_requests table,
  allowing the Admin RTO Requests page to receive live updates when
  new time-off requests are submitted or when admins approve/deny requests.

  ## Changes
  1. Add rto_requests table to supabase_realtime publication
     - Enables INSERT, UPDATE, DELETE event broadcasts
     - Allows admin pages to subscribe to real-time changes
     - Allows instant updates when employees submit new requests
     - No impact on webhook or form submission process

  ## Security
  - Realtime respects existing Row Level Security (RLS) policies
  - Only authenticated users with proper permissions receive updates
  - Admins see all requests, employees only see their own
  - Does not expose data to unauthorized users
  - Subscription requires valid JWT token

  ## Important Notes
  - Does not modify authentication flow
  - Does not change signup/login behavior
  - Does not affect Make.com webhook integration
  - Does not change RTO form submission process
  - Only enables real-time event broadcasting
  - Client-side subscription already implemented in AdminRTO.tsx
*/

-- Enable realtime replication for the rto_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE public.rto_requests;
