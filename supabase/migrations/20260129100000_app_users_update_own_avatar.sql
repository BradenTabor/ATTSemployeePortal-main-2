/*
  # Allow users to update their own avatar_url

  app_users UPDATE is restricted to admins. Employees cannot update their row,
  so avatar uploads succeeded (storage) but avatar_url in app_users was never
  saved. This adds an RPC that lets any authenticated user update only their
  own avatar_url (set or clear).
*/

create or replace function public.update_my_avatar_url(p_path text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.app_users
  set avatar_url = p_path
  where user_id = auth.uid();
$$;

comment on function public.update_my_avatar_url(text) is
  'Allows authenticated users to set or clear their own avatar_url. Used by profile avatar upload/remove.';

grant execute on function public.update_my_avatar_url(text) to authenticated;
