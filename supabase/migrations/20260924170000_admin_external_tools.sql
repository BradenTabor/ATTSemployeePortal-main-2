-- Credentials are provisioned separately; never include secrets in migrations.
create table public.admin_external_tools (
  id text primary key,
  password text not null check (length(password) > 0)
);

alter table public.admin_external_tools enable row level security;
revoke all on public.admin_external_tools from anon, authenticated;
grant select on public.admin_external_tools to authenticated;
grant all on public.admin_external_tools to service_role;

create policy admin_external_tools_read on public.admin_external_tools
for select to authenticated using (public.is_admin());

-- POST RPC avoids service-worker GET caching, including older installed PWAs.
create function public.get_po_monitor_password() returns text
language sql stable security invoker set search_path = public
as $$ select password from public.admin_external_tools where id = 'po-monitor' $$;
revoke all on function public.get_po_monitor_password() from public, anon;
grant execute on function public.get_po_monitor_password() to authenticated;
