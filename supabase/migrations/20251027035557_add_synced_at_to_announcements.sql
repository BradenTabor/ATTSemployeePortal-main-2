/*
  # Add synced_at Timestamp to Announcements

  1. Changes
    - Add `synced_at` column to `announcements` table
      - Type: timestamptz (timestamp with timezone)
      - Nullable: true (for backwards compatibility with existing records)
      - Purpose: Track when each announcement was synced from Make.com

  2. Important Notes
    - This field will be automatically populated by the Edge Function during sync
    - Frontend will display the most recent sync time to users
    - No changes needed to RLS policies
*/

-- Add synced_at column to announcements table
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- Create index on synced_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_announcements_synced_at ON announcements(synced_at DESC);
