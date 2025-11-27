/*
  # Create Announcements Storage System

  1. New Tables
    - `announcements`
      - `id` (uuid, primary key) - Unique identifier for each announcement
      - `title` (text) - Announcement title
      - `date` (date) - Date of the announcement
      - `content` (text) - Full announcement content/description
      - `raw_data` (jsonb) - Store original data structure from Make.com
      - `created_at` (timestamptz) - When the record was created
      - `updated_at` (timestamptz) - When the record was last updated

    - `announcement_metadata`
      - `id` (uuid, primary key)
      - `last_sync` (timestamptz) - Last time Make.com synced data
      - `total_count` (integer) - Total number of announcements
      - `updated_at` (timestamptz) - Metadata last updated

  2. Security
    - Enable RLS on both tables
    - Allow public read access (all employees can view announcements)
    - Restrict write access to service role only (Make.com webhook)

  3. Important Notes
    - Announcements are publicly readable by all authenticated users
    - Only the backend API (via service role) can write/update announcements
    - The metadata table tracks sync status for monitoring
*/

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  date date NOT NULL,
  content text NOT NULL DEFAULT '',
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create metadata table for tracking sync status
CREATE TABLE IF NOT EXISTS announcement_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_sync timestamptz DEFAULT now(),
  total_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Create index on date for efficient sorting
CREATE INDEX IF NOT EXISTS idx_announcements_date ON announcements(date DESC);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_metadata ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read announcements
CREATE POLICY "Anyone can read announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public read of announcements (for unauthenticated access)
CREATE POLICY "Public can read announcements"
  ON announcements
  FOR SELECT
  TO anon
  USING (true);

-- Allow service role to manage announcements
CREATE POLICY "Service role can manage announcements"
  ON announcements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read metadata
CREATE POLICY "Anyone can read metadata"
  ON announcement_metadata
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public read of metadata
CREATE POLICY "Public can read metadata"
  ON announcement_metadata
  FOR SELECT
  TO anon
  USING (true);

-- Allow service role to manage metadata
CREATE POLICY "Service role can manage metadata"
  ON announcement_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert initial metadata record
INSERT INTO announcement_metadata (last_sync, total_count)
VALUES (now(), 0)
ON CONFLICT DO NOTHING;
