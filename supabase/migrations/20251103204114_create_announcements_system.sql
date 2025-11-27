/*
  # Create Announcements System

  1. New Tables
    - `announcements`
      - `id` (uuid, primary key) - Unique identifier
      - `title` (text) - Announcement title
      - `message` (text) - Announcement content/body
      - `author` (text, optional) - Author name
      - `date` (date) - Announcement date
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on announcements table
    - Allow all users (authenticated and anonymous) to read announcements
    - Allow inserts from anyone (for Make.com webhook without auth)
    - This enables public access for displaying announcements

  3. Features
    - All users can view announcements regardless of role
    - Make.com webhook can insert new announcements
    - Sorted by creation date (newest first)

  4. Important Notes
    - Public read access for maximum flexibility
    - Insert access for webhook automation
    - No update/delete to maintain announcement history
*/

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  author text,
  date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_announcements_created_at 
  ON public.announcements(created_at DESC);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow all users to read announcements (authenticated)
CREATE POLICY "Allow all authenticated users to read announcements"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy 2: Allow public/anonymous read (for flexibility)
CREATE POLICY "Allow public to read announcements"
  ON public.announcements
  FOR SELECT
  TO anon
  USING (true);

-- Policy 3: Allow Make.com webhook inserts (no auth required)
CREATE POLICY "Allow Make.com webhook inserts"
  ON public.announcements
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Insert sample announcement for testing
INSERT INTO public.announcements (title, message, author, date)
VALUES 
  ('Welcome to ATTS Employee Portal', 'This is your central hub for all company announcements, time-off requests, and resources.', 'ATTS Admin', CURRENT_DATE)
ON CONFLICT DO NOTHING;
