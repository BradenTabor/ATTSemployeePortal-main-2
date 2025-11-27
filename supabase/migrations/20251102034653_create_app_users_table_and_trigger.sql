/*
  # Create App Users Table and Role Assignment System

  ## Overview
  This migration creates a role-based authorization system for the ATTS Employee Portal
  without modifying the existing authentication flow. Users can have roles: employee, admin, or manager.

  ## Tables Created
  1. `public.app_users`
     - `id` (uuid, primary key) - Unique identifier for app user record
     - `user_id` (uuid, foreign key) - References auth.users(id), cascades on delete
     - `role` (text) - User role: 'employee' (default), 'admin', or 'manager'
     - `created_at` (timestamp) - Record creation timestamp

  ## Triggers
  - `on_auth_user_created` - Automatically creates app_users record when new user signs up
    - Default role: 'employee'
    - Executes after insert on auth.users table

  ## Security
  - Row Level Security (RLS) enabled on app_users table
  - Users can read their own role
  - Only authenticated users can access the table
  - Admins cannot be created through signup (must be manually promoted)

  ## Important Notes
  - This migration does NOT modify existing authentication flow
  - All signup/login behavior remains unchanged
  - Existing users will need manual role assignment
  - New users automatically get 'employee' role
*/

-- Create app_users table
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text default 'employee' not null check (role in ('employee', 'admin', 'manager')),
  created_at timestamptz default now() not null
);

-- Enable Row Level Security
alter table public.app_users enable row level security;

-- Create policy: Users can read their own role
create policy "Users can read own role"
  on public.app_users
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Create policy: System can insert new users (via trigger)
create policy "System can insert new users"
  on public.app_users
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Create function to handle new user registration
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.app_users (user_id, role)
  values (new.id, 'employee');
  return new;
exception
  when others then
    raise log 'Error in handle_new_user trigger: %', sqlerrm;
    return new;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger to auto-create app_users record on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Create index for faster role lookups
create index if not exists idx_app_users_user_id on public.app_users(user_id);
create index if not exists idx_app_users_role on public.app_users(role);
