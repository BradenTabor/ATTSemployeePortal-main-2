-- Prevent two admins grading the same pending certification simultaneously.
-- Lock is on certification_attempts (one row per pending review card).

ALTER TABLE public.certification_attempts
  ADD COLUMN IF NOT EXISTS grading_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS grading_started_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.certification_attempts.grading_started_at IS
  'When an admin opened this attempt for grading; cleared on submit or unmount.';
COMMENT ON COLUMN public.certification_attempts.grading_started_by IS
  'Admin (auth.users.id) who opened this attempt for grading.';

CREATE INDEX IF NOT EXISTS idx_certification_attempts_grading_started_by
  ON public.certification_attempts(grading_started_by);

-- RPC: claim grading lock when opening a card (admin only)
CREATE OR REPLACE FUNCTION public.set_certification_grading_started(p_attempt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can claim grading.';
  END IF;

  UPDATE public.certification_attempts
  SET
    grading_started_at = now(),
    grading_started_by = auth.uid()
  WHERE id = p_attempt_id
    AND status = 'submitted';
END;
$$;

COMMENT ON FUNCTION public.set_certification_grading_started(uuid) IS
  'Claim grading lock for an attempt (call when opening pending review card).';

-- RPC: release grading lock on unmount or after submit (only if current user claimed it)
CREATE OR REPLACE FUNCTION public.clear_certification_grading_started(p_attempt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.certification_attempts
  SET
    grading_started_at = null,
    grading_started_by = null
  WHERE id = p_attempt_id
    AND grading_started_by = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.clear_certification_grading_started(uuid) IS
  'Release grading lock when closing card or after submit (only if caller claimed it).';

GRANT EXECUTE ON FUNCTION public.set_certification_grading_started(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_certification_grading_started(uuid) TO authenticated;

-- View: expose grading lock and grader name for banner (recreate after 20260219200000)
DROP VIEW IF EXISTS public.pending_certification_reviews;
CREATE VIEW public.pending_certification_reviews
  WITH (security_invoker = true)
AS
SELECT
  ca.id AS attempt_id,
  ca.user_id,
  au.full_name AS user_name,
  ct.id AS certification_type_id,
  ct.name AS certification_name,
  ct.slug AS certification_slug,
  ca.submitted_at,
  ca.total_questions,
  ca.correct_answers,
  ca.score_percentage,
  ca.answers,
  ca.grading_started_at,
  ca.grading_started_by,
  grader_au.full_name AS grading_started_by_name,
  (
    SELECT COUNT(*)::int
    FROM jsonb_array_elements(ca.answers) a(value)
    WHERE (a.value ->> 'pending_review')::boolean = true
  ) AS pending_count
FROM public.certification_attempts ca
JOIN public.certification_types ct ON ct.id = ca.certification_type_id
LEFT JOIN public.app_users au ON au.user_id = ca.user_id
LEFT JOIN public.app_users grader_au ON grader_au.user_id = ca.grading_started_by
WHERE ca.status = 'submitted';

COMMENT ON VIEW public.pending_certification_reviews IS
  'Certification attempts pending admin review. SECURITY INVOKER.';

-- Clear grading lock when grading completes (admin_grade_short_answers)
CREATE OR REPLACE FUNCTION public.admin_grade_short_answers(
  p_attempt_id UUID,
  p_grades JSONB
)
RETURNS TABLE (
  passed BOOLEAN,
  score_percentage NUMERIC,
  correct_answers INTEGER,
  total_questions INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt RECORD;
  v_answers JSONB;
  v_pass_threshold INTEGER;
  v_has_practical BOOLEAN;
  v_validity INTERVAL;
  v_idx INT;
  v_grade JSONB;
  v_qid TEXT;
  v_is_correct BOOLEAN;
  v_total_pts INTEGER := 0;
  v_earned INTEGER := 0;
  v_correct INTEGER := 0;
  v_score NUMERIC;
  v_answer JSONB;
  v_new_answers JSONB := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'general_foreman')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin or General Foreman role required';
  END IF;

  SELECT * INTO v_attempt
  FROM public.certification_attempts
  WHERE id = p_attempt_id
    AND status = 'submitted';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or not in submitted status';
  END IF;

  SELECT ct.passing_score, ct.has_practical_eval,
         (ct.validity_months || ' months')::interval
  INTO v_pass_threshold, v_has_practical, v_validity
  FROM public.certification_types ct
  WHERE ct.id = v_attempt.certification_type_id;

  v_answers := v_attempt.answers;

  FOR v_idx IN 0 .. jsonb_array_length(v_answers) - 1 LOOP
    v_answer := v_answers->v_idx;
    SELECT g INTO v_grade
    FROM jsonb_array_elements(p_grades) g
    WHERE g->>'question_id' = v_answer->>'question_id';

    IF v_grade IS NOT NULL AND (v_answer->>'pending_review')::boolean = true THEN
      v_is_correct := (v_grade->>'is_correct')::boolean;
      v_answer := v_answer || jsonb_build_object(
        'is_correct', v_is_correct,
        'pending_review', false,
        'graded_by_admin', true,
        'admin_notes', COALESCE(v_grade->>'admin_notes', '')
      );
    END IF;

    v_total_pts := v_total_pts + COALESCE((v_answer->>'points')::int, 1);
    IF (v_answer->>'is_correct')::boolean = true THEN
      v_correct := v_correct + 1;
      v_earned := v_earned + COALESCE((v_answer->>'points')::int, 1);
    END IF;

    v_new_answers := v_new_answers || v_answer;
  END LOOP;

  IF v_total_pts = 0 THEN
    v_score := 0;
  ELSE
    v_score := (v_earned::numeric / v_total_pts::numeric) * 100;
  END IF;

  UPDATE public.certification_attempts
  SET
    status = 'graded',
    completed_at = now(),
    answers = v_new_answers,
    correct_answers = v_correct,
    earned_points = v_earned,
    score_percentage = v_score,
    passed = (v_score >= v_pass_threshold),
    graded_by = auth.uid(),
    graded_at = now(),
    grading_started_at = null,
    grading_started_by = null
  WHERE id = p_attempt_id;

  IF v_score >= v_pass_threshold THEN
    INSERT INTO public.certification_records (
      user_id,
      certification_type_id,
      written_attempt_id,
      written_passed_at,
      written_score,
      status,
      expires_at
    ) VALUES (
      v_attempt.user_id,
      v_attempt.certification_type_id,
      p_attempt_id,
      now(),
      v_score,
      CASE WHEN v_has_practical THEN 'written_passed'::text ELSE 'active'::text END,
      now() + v_validity
    )
    ON CONFLICT (user_id, certification_type_id) WHERE (status IN ('pending', 'written_passed', 'active'))
    DO UPDATE SET
      written_attempt_id = EXCLUDED.written_attempt_id,
      written_passed_at = EXCLUDED.written_passed_at,
      written_score = EXCLUDED.written_score,
      status = EXCLUDED.status,
      expires_at = EXCLUDED.expires_at,
      updated_at = now();
  END IF;

  passed := (v_score >= v_pass_threshold);
  score_percentage := v_score;
  correct_answers := v_correct;
  total_questions := jsonb_array_length(v_new_answers);
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.admin_grade_short_answers(UUID, JSONB) IS
  'Admin function to grade short_answer questions and finalize attempt. Clears grading lock on success.';
