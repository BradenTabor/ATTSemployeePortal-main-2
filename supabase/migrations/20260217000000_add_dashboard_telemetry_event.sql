-- Add dashboard_action event for dashboard success metrics (visits, section expands, link clicks, pull-refresh).
-- See docs/dashboard-contract.md and src/lib/telemetry.ts.

ALTER TABLE public.telemetry_events
  DROP CONSTRAINT IF EXISTS telemetry_events_event_name_check;

ALTER TABLE public.telemetry_events
  ADD CONSTRAINT telemetry_events_event_name_check CHECK (event_name IN (
    'form_started',
    'form_submitted',
    'form_submit_error',
    'announcement_viewed',
    'form_duplicate_detected',
    'form_duplicate_prevented',
    'form_duplicate_overridden',
    'avatar_uploaded',
    'avatar_removed',
    'avatar_upload_failed',
    'dashboard_action'
  ));

COMMENT ON COLUMN public.telemetry_events.event_name IS
  'Event type. dashboard_action uses properties.action: view | section_expand | form_link_click | job_card_click | pull_refresh | view_all_jobs.';
