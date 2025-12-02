/*
  # Contact requests table

  Persists submissions from the Contact page so admins can triage inbound
  messages, while regular employees can only view their own entries.
*/

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  submitted_at timestamptz not null default now()
);

comment on table public.contact_requests is
  'Inbound messages submitted through the Contact page.';

create index if not exists contact_requests_user_idx on public.contact_requests(user_id);
create index if not exists contact_requests_submitted_at_idx on public.contact_requests(submitted_at desc);

alter table public.contact_requests enable row level security;

drop policy if exists "contact_requests_insert_own" on public.contact_requests;
drop policy if exists "contact_requests_select_self" on public.contact_requests;
drop policy if exists "contact_requests_select_admin" on public.contact_requests;

create policy "contact_requests_insert_own"
  on public.contact_requests
  for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

create policy "contact_requests_select_self"
  on public.contact_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "contact_requests_select_admin"
  on public.contact_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.user_id = auth.uid()
        and au.role = 'admin'
    )
  );

