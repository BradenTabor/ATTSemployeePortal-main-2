/*
  # Mechanic fix tracking for equipment inspections

  Adds columns so mechanics/admins can record deficiencies they corrected on
  each equipment inspection.
*/

alter table public.daily_equipment_inspections
  add column if not exists mechanic_fixes text,
  add column if not exists last_mechanic_updated_at timestamptz;

-- Policy adjustments: allow admins/mechanics to update fix fields only
drop policy if exists "equipment_inspection_fix_update" on public.daily_equipment_inspections;

create policy "equipment_inspection_fix_update"
  on public.daily_equipment_inspections
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.role in ('admin', 'mechanic')
    )
  )
  with check (
    exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.role in ('admin', 'mechanic')
    )
  );

