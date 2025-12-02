/*
  # Daily Equipment Inspection – submitted_by column

  Adds a text column so we can persist the name of the operator who submitted
  the Daily Equipment Inspection form.
*/

alter table public.daily_equipment_inspections
  add column if not exists submitted_by text;

