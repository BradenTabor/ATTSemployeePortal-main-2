-- Drop drivers_signature_section_a from dvir_reports.
-- Driver signature is now collected only at the bottom of the DVIR form
-- (Driver & Foreman Sign-off), so Section A signature is redundant.

alter table public.dvir_reports
  drop column if exists drivers_signature_section_a;
