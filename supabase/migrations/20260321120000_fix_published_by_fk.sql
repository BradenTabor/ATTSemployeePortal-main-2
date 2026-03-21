-- Fix: safety_announcements.published_by FK blocks user deletion (NO ACTION → SET NULL)
-- This was the last remaining NO ACTION constraint referencing auth.users(id).
ALTER TABLE public.safety_announcements
  DROP CONSTRAINT safety_announcements_published_by_fkey,
  ADD CONSTRAINT safety_announcements_published_by_fkey
    FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE SET NULL;
