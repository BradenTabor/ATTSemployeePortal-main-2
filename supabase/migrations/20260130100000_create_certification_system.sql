-- =============================================================================
-- Certification System — Core Schema
-- =============================================================================
-- State-machine model with audit trail, renewal tracking, stratified question
-- selection. Uses app_users.user_id = auth.uid() for RLS (Phase 0.5).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- certification_types
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT CHECK (category IN ('equipment', 'safety', 'skill')),
  passing_score INTEGER NOT NULL DEFAULT 80,
  validity_months INTEGER NOT NULL DEFAULT 12,
  has_written_test BOOLEAN DEFAULT true,
  has_practical_eval BOOLEAN DEFAULT false,
  question_count INTEGER,
  question_categories JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.certification_types IS 'Master list of certification types (e.g. Bucket Trimmer, Geo-Boy).';
COMMENT ON COLUMN public.certification_types.question_categories IS 'Proportions per category for stratified sampling, e.g. {"hardware": 0.4, "knots": 0.3, "observation": 0.3}.';

DROP TRIGGER IF EXISTS trigger_update_certification_types_updated_at ON public.certification_types;
CREATE TRIGGER trigger_update_certification_types_updated_at
  BEFORE UPDATE ON public.certification_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- certification_questions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certification_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_type_id UUID NOT NULL REFERENCES public.certification_types(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false')),
  options JSONB,
  correct_answer TEXT NOT NULL,
  points INTEGER DEFAULT 1,
  category TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(certification_type_id, question_number)
);

COMMENT ON TABLE public.certification_questions IS 'Question bank per certification. Access only via RPCs (no direct SELECT) to avoid answer leakage.';

CREATE INDEX IF NOT EXISTS idx_certification_questions_type_active
  ON public.certification_questions(certification_type_id, is_active) WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- certification_attempts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_type_id UUID NOT NULL REFERENCES public.certification_types(id),
  attempt_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'graded', 'abandoned')),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_questions INTEGER,
  correct_answers INTEGER,
  total_points INTEGER,
  earned_points INTEGER,
  score_percentage NUMERIC(5,2),
  passed BOOLEAN,
  time_spent_seconds INTEGER,
  graded_by UUID REFERENCES auth.users(id),
  graded_at TIMESTAMPTZ,
  UNIQUE(user_id, certification_type_id, attempt_number)
);

COMMENT ON TABLE public.certification_attempts IS 'One row per test attempt. Grading only via submit_certification_test RPC.';
COMMENT ON COLUMN public.certification_attempts.answers IS 'Graded shape: [{question_id, user_answer, correct_answer, is_correct, points}]. Filled on submit.';

CREATE INDEX IF NOT EXISTS idx_certification_attempts_user_cert
  ON public.certification_attempts(user_id, certification_type_id);
CREATE INDEX IF NOT EXISTS idx_certification_attempts_status
  ON public.certification_attempts(status);

-- -----------------------------------------------------------------------------
-- practical_evaluation_templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practical_evaluation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_type_id UUID NOT NULL REFERENCES public.certification_types(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  category_order INTEGER NOT NULL,
  items JSONB NOT NULL,
  items_count INTEGER NOT NULL,
  UNIQUE(certification_type_id, category_name)
);

COMMENT ON TABLE public.practical_evaluation_templates IS 'Checklist template per cert (e.g. hardware_identification, knots_and_rigging). items: [{"item_id","item_name"}].';

-- -----------------------------------------------------------------------------
-- practical_evaluations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.practical_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_type_id UUID NOT NULL REFERENCES public.certification_types(id),
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  evaluation_date TIMESTAMPTZ DEFAULT now(),
  checklist_items JSONB NOT NULL,
  items_total INTEGER NOT NULL,
  items_passed INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  evaluator_notes TEXT,
  evaluator_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN public.practical_evaluations.checklist_items IS '{"<category_name>": [{"item_id","item_name","passed","notes"}], ...}';

CREATE INDEX IF NOT EXISTS idx_practical_evaluations_user_cert
  ON public.practical_evaluations(user_id, certification_type_id);
CREATE INDEX IF NOT EXISTS idx_practical_evaluations_evaluator
  ON public.practical_evaluations(evaluator_id);

-- -----------------------------------------------------------------------------
-- certification_records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_type_id UUID NOT NULL REFERENCES public.certification_types(id),
  written_attempt_id UUID REFERENCES public.certification_attempts(id),
  written_passed_at TIMESTAMPTZ,
  written_score NUMERIC(5,2),
  practical_evaluation_id UUID REFERENCES public.practical_evaluations(id),
  practical_passed_at TIMESTAMPTZ,
  certified_at TIMESTAMPTZ,
  certified_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'written_passed', 'active', 'expired', 'revoked', 'renewed')),
  renewal_of UUID REFERENCES public.certification_records(id),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.certification_records IS 'One active/pending per user per type. State: pending -> written_passed -> active -> expired|revoked|renewed.';

CREATE UNIQUE INDEX idx_certification_records_active_unique
  ON public.certification_records(user_id, certification_type_id)
  WHERE status IN ('pending', 'written_passed', 'active');

CREATE INDEX IF NOT EXISTS idx_certification_records_user ON public.certification_records(user_id);
CREATE INDEX IF NOT EXISTS idx_certification_records_status ON public.certification_records(status);
CREATE INDEX IF NOT EXISTS idx_certification_records_expires ON public.certification_records(expires_at);

DROP TRIGGER IF EXISTS trigger_update_certification_records_updated_at ON public.certification_records;
CREATE TRIGGER trigger_update_certification_records_updated_at
  BEFORE UPDATE ON public.certification_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Expiration job
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_expired_certifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.certification_records
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();
END;
$$;

COMMENT ON FUNCTION public.update_expired_certifications() IS 'Marks active certs past expires_at as expired. Run daily via pg_cron.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('update-expired-certs');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('update-expired-certs', '0 2 * * *', 'SELECT public.update_expired_certifications()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available, skipping certification expiration schedule';
END $outer$;
