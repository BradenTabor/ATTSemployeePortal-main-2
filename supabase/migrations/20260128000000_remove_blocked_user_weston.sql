/*
  Remove blocked user weston@alltts.com from Supabase entirely.

  - Deletes the user from auth.users so they can no longer log in.
  - app_users row is removed automatically via ON DELETE CASCADE on
    app_users.user_id -> auth.users(id).
*/

DELETE FROM auth.users
WHERE email = 'weston@alltts.com';
