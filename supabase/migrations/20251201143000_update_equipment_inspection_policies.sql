/*
  # Expand equipment inspection select access

  Mechanics now need to review every equipment inspection, so allow both
  mechanics and admins to select all rows from daily_equipment_inspections.
*/

drop policy if exists "equipment_inspection_admin_select" on public.daily_equipment_inspections;
drop policy if exists "equipment_inspection_mechanic_select" on public.daily_equipment_inspections;

create policy "equipment_inspection_mech_admin_select"
  on public.daily_equipment_inspections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.role in ('admin', 'mechanic')
    )
  );

