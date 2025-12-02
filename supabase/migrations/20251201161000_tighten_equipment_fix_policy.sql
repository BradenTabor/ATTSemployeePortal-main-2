/*
  # Restrict mechanic fix updates to specific columns

  Mechanics should only edit `mechanic_fixes` and `last_mechanic_updated_at`.
  This policy enforces that all other columns remain unchanged.
*/

drop policy if exists "equipment_inspection_fix_update" on public.daily_equipment_inspections;

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
    (
      select to_jsonb(original) - '{mechanic_fixes,last_mechanic_updated_at}'
      from public.daily_equipment_inspections as original
      where original.id = daily_equipment_inspections.id
    ) =
    to_jsonb(daily_equipment_inspections) - '{mechanic_fixes,last_mechanic_updated_at}'
  );

