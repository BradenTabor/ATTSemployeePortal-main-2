/*
  Fix FK constraints that block user deletion from auth.users.

  When supabaseAdmin.auth.admin.deleteUser() runs, the auth.users row is deleted,
  cascading to app_users. But 27 FK constraints in public schema either:
    (a) have NOT NULL + ON DELETE SET NULL (contradictory), or
    (b) default to NO ACTION / RESTRICT (blocks if rows exist).

  This migration converts all of them to ON DELETE SET NULL with nullable columns.

  Also adds denormalized winner_name columns to monthly_reward_drawings so that
  safety draw results survive user deletion.
*/

-- ============================================================================
-- Category 1: NOT NULL + ON DELETE SET NULL  (drop NOT NULL only)
-- ============================================================================

ALTER TABLE public.user_management_log
  ALTER COLUMN performed_by_user_id DROP NOT NULL;

ALTER TABLE public.jsa_sharing_audit
  ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE public.mass_sms_log
  ALTER COLUMN admin_user_id DROP NOT NULL;

ALTER TABLE public.corrective_actions
  ALTER COLUMN assigned_by DROP NOT NULL;

-- ============================================================================
-- Category 2: NOT NULL + NO ACTION  (drop NOT NULL, replace FK with SET NULL)
-- ============================================================================

ALTER TABLE public.daily_attendance
  DROP CONSTRAINT daily_attendance_marked_by_fkey,
  ALTER COLUMN marked_by DROP NOT NULL,
  ADD CONSTRAINT daily_attendance_marked_by_fkey
    FOREIGN KEY (marked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.external_certification_types
  DROP CONSTRAINT external_certification_types_created_by_fkey,
  ALTER COLUMN created_by DROP NOT NULL,
  ADD CONSTRAINT external_certification_types_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.attendance_summaries
  DROP CONSTRAINT attendance_summaries_generated_by_fkey,
  ALTER COLUMN generated_by DROP NOT NULL,
  ADD CONSTRAINT attendance_summaries_generated_by_fkey
    FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.practical_evaluations
  DROP CONSTRAINT practical_evaluations_evaluator_id_fkey,
  ALTER COLUMN evaluator_id DROP NOT NULL,
  ADD CONSTRAINT practical_evaluations_evaluator_id_fkey
    FOREIGN KEY (evaluator_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- worker_external_certifications: 3 columns in one statement
ALTER TABLE public.worker_external_certifications
  DROP CONSTRAINT worker_external_certifications_granted_by_fkey,
  DROP CONSTRAINT worker_external_certifications_verified_by_fkey,
  DROP CONSTRAINT worker_external_certifications_revoked_by_fkey,
  ALTER COLUMN granted_by DROP NOT NULL,
  ADD CONSTRAINT worker_external_certifications_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT worker_external_certifications_verified_by_fkey
    FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT worker_external_certifications_revoked_by_fkey
    FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- Category 3: Nullable + NO ACTION  (replace FK with SET NULL)
-- ============================================================================

ALTER TABLE public.app_settings
  DROP CONSTRAINT app_settings_updated_by_fkey,
  ADD CONSTRAINT app_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.app_settings_audit
  DROP CONSTRAINT app_settings_audit_changed_by_fkey,
  ADD CONSTRAINT app_settings_audit_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- certification_attempts: 2 columns
ALTER TABLE public.certification_attempts
  DROP CONSTRAINT certification_attempts_graded_by_fkey,
  DROP CONSTRAINT certification_attempts_grading_started_by_fkey,
  ADD CONSTRAINT certification_attempts_graded_by_fkey
    FOREIGN KEY (graded_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT certification_attempts_grading_started_by_fkey
    FOREIGN KEY (grading_started_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- certification_records: 3 columns
ALTER TABLE public.certification_records
  DROP CONSTRAINT certification_records_certified_by_fkey,
  DROP CONSTRAINT certification_records_reviewed_by_fkey,
  DROP CONSTRAINT certification_records_revoked_by_fkey,
  ADD CONSTRAINT certification_records_certified_by_fkey
    FOREIGN KEY (certified_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT certification_records_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT certification_records_revoked_by_fkey
    FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.company_calendar
  DROP CONSTRAINT company_calendar_created_by_fkey,
  ADD CONSTRAINT company_calendar_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.monthly_safety_rewards
  DROP CONSTRAINT monthly_safety_rewards_created_by_fkey,
  ADD CONSTRAINT monthly_safety_rewards_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.rto_requests
  DROP CONSTRAINT rto_requests_approved_by_fkey,
  ADD CONSTRAINT rto_requests_approved_by_fkey
    FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.safety_announcements
  DROP CONSTRAINT safety_announcements_created_by_fkey,
  ADD CONSTRAINT safety_announcements_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_absences
  DROP CONSTRAINT user_absences_created_by_fkey,
  ADD CONSTRAINT user_absences_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- monthly_reward_drawings: add denormalized winner names + fix FKs
-- ============================================================================

ALTER TABLE public.monthly_reward_drawings
  ADD COLUMN IF NOT EXISTS grand_prize_winner_name TEXT,
  ADD COLUMN IF NOT EXISTS runner_up_1_winner_name TEXT,
  ADD COLUMN IF NOT EXISTS runner_up_2_winner_name TEXT,
  DROP CONSTRAINT monthly_reward_drawings_drawn_by_fkey,
  DROP CONSTRAINT monthly_reward_drawings_grand_prize_winner_id_fkey,
  DROP CONSTRAINT monthly_reward_drawings_runner_up_1_winner_id_fkey,
  DROP CONSTRAINT monthly_reward_drawings_runner_up_2_winner_id_fkey,
  ADD CONSTRAINT monthly_reward_drawings_drawn_by_fkey
    FOREIGN KEY (drawn_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT monthly_reward_drawings_grand_prize_winner_id_fkey
    FOREIGN KEY (grand_prize_winner_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT monthly_reward_drawings_runner_up_1_winner_id_fkey
    FOREIGN KEY (runner_up_1_winner_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT monthly_reward_drawings_runner_up_2_winner_id_fkey
    FOREIGN KEY (runner_up_2_winner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill existing winner names from app_users
UPDATE public.monthly_reward_drawings d
SET grand_prize_winner_name = u.full_name
FROM public.app_users u
WHERE d.grand_prize_winner_id = u.user_id
  AND d.grand_prize_winner_name IS NULL;

UPDATE public.monthly_reward_drawings d
SET runner_up_1_winner_name = u.full_name
FROM public.app_users u
WHERE d.runner_up_1_winner_id = u.user_id
  AND d.runner_up_1_winner_name IS NULL;

UPDATE public.monthly_reward_drawings d
SET runner_up_2_winner_name = u.full_name
FROM public.app_users u
WHERE d.runner_up_2_winner_id = u.user_id
  AND d.runner_up_2_winner_name IS NULL;

COMMENT ON COLUMN public.monthly_reward_drawings.grand_prize_winner_name IS 'Denormalized winner name — preserved after user deletion';
COMMENT ON COLUMN public.monthly_reward_drawings.runner_up_1_winner_name IS 'Denormalized winner name — preserved after user deletion';
COMMENT ON COLUMN public.monthly_reward_drawings.runner_up_2_winner_name IS 'Denormalized winner name — preserved after user deletion';
