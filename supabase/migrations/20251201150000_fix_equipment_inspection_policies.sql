/*
  # Fix equipment inspection policies

  The original policies referenced `app_users.id`, but the table uses `user_id`.
  Recreate both select/update policies with the correct column so mechanics and
  admins can review and update inspections.
*/

drop policy if exists "equipment_inspection_mech_admin_select" on public.daily_equipment_inspections;
drop policy if exists "equipment_inspection_fix_update" on public.daily_equipment_inspections;

create policy "equipment_inspection_mech_admin_select"
  on public.daily_equipment_inspections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.user_id = auth.uid()
        and au.role in ('admin', 'mechanic')
    )
  );

create policy "equipment_inspection_fix_update"
  on public.daily_equipment_inspections
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.user_id = auth.uid()
        and au.role in ('admin', 'mechanic')
    )
  )
  with check (
    exists (
      select 1
      from public.app_users au
      where au.user_id = auth.uid()
        and au.role in ('admin', 'mechanic')
    )
  );

