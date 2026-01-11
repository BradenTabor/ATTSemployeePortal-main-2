/*
  # Create Announcement Rewards System

  1. New Tables
    - `announcement_rewards`
      - `id` (uuid, primary key) - Unique identifier for each reward claim
      - `user_id` (uuid) - FK to auth.users, the user who claimed the reward
      - `announcement_id` (uuid) - FK to announcements, the announcement being rewarded
      - `points_awarded` (integer) - Points given for this claim (default 1)
      - `claimed_at` (timestamptz) - When the reward was claimed

  2. Constraints
    - UNIQUE(user_id, announcement_id) - Prevents duplicate claims per user per announcement
    - Foreign keys to auth.users and announcements tables

  3. Security
    - Enable RLS on the table
    - Users can SELECT their own rewards
    - Users can INSERT their own rewards (one-time per announcement)
    - Admins can SELECT all rewards for reporting

  4. Purpose
    - Gamification feature for Safety AI-generated announcements
    - Users earn 1 point by clicking "Collect Points" on Safety AI announcements
    - Each user can only claim once per announcement (enforced by unique constraint)
*/

-- Create announcement_rewards table
CREATE TABLE IF NOT EXISTS public.announcement_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  points_awarded integer NOT NULL DEFAULT 1,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  
  -- Prevent duplicate claims: one claim per user per announcement
  CONSTRAINT unique_user_announcement_claim UNIQUE (user_id, announcement_id)
);

-- Add helpful comment
COMMENT ON TABLE public.announcement_rewards IS 'Tracks user reward claims for Safety AI-generated announcements';
COMMENT ON COLUMN public.announcement_rewards.points_awarded IS 'Points awarded for this claim (default 1)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcement_rewards_user_id 
  ON public.announcement_rewards(user_id);

CREATE INDEX IF NOT EXISTS idx_announcement_rewards_announcement_id 
  ON public.announcement_rewards(announcement_id);

CREATE INDEX IF NOT EXISTS idx_announcement_rewards_claimed_at 
  ON public.announcement_rewards(claimed_at DESC);

-- Composite index for checking if user has claimed a specific announcement
CREATE INDEX IF NOT EXISTS idx_announcement_rewards_user_announcement 
  ON public.announcement_rewards(user_id, announcement_id);

-- Enable Row Level Security
ALTER TABLE public.announcement_rewards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own rewards
CREATE POLICY "Users can read own rewards"
  ON public.announcement_rewards
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Admins can read all rewards (for reporting/analytics)
CREATE POLICY "Admins can read all rewards"
  ON public.announcement_rewards
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Policy: Users can insert their own rewards (claim points)
-- The unique constraint prevents duplicate claims at DB level
CREATE POLICY "Users can claim rewards"
  ON public.announcement_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Service role has full access (for admin operations)
CREATE POLICY "Service role has full access to rewards"
  ON public.announcement_rewards
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to get total points for a user
CREATE OR REPLACE FUNCTION public.get_user_total_points(target_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points_awarded), 0)::integer
  FROM public.announcement_rewards
  WHERE user_id = target_user_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_total_points(uuid) TO authenticated;

-- Comment on function
COMMENT ON FUNCTION public.get_user_total_points IS 'Returns total reward points for a user (defaults to current user)';

