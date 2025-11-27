/*
  # Update Auth User Trigger to Sync Email

  1. Changes
    - Updates the existing `handle_new_user()` function to sync email addresses
    - Ensures new auth.users get their email copied to app_users.email
    - Maintains backward compatibility with existing user_id column
    - Adds upsert logic to handle re-runs and updates

  2. New Behavior
    - When a new user signs up via auth.users
    - Trigger automatically inserts into app_users with:
      - user_id = new.id (auth user UUID)
      - email = new.email (from auth.users)
      - role = 'employee' (default)
    - If user already exists, updates their email

  3. Impact
    - ✅ New signups automatically get email synced
    - ✅ Admin RTO page can display user emails
    - ✅ No manual data entry needed
    - ✅ Existing trigger preserved (no breaking changes)

  4. Important Notes
    - Uses SECURITY DEFINER to bypass RLS during insert
    - Handles conflicts gracefully with ON CONFLICT
    - Maintains exception handling for reliability
*/

-- Drop and recreate the function with email sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new user with email, or update email if user exists
  INSERT INTO public.app_users (user_id, email, role)
  VALUES (new.id, new.email, 'employee')
  ON CONFLICT (user_id) 
  DO UPDATE SET email = EXCLUDED.email;
  
  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists (it should already be there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_schema = 'auth'
    AND trigger_name = 'on_auth_user_created'
    AND event_object_table = 'users'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Backfill existing users who don't have emails
UPDATE public.app_users au
SET email = u.email
FROM auth.users u
WHERE au.user_id = u.id
AND au.email IS NULL;
