/*
  # Allow mechanic role in app_users

  Extends the role check constraint so Supabase can persist the `mechanic`
  role that the frontend expects for mechanic dashboards.
*/

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('employee', 'admin', 'manager', 'mechanic'));

