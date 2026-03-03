-- Add reviewer tracking to certification_records (set when admin grades written test).

ALTER TABLE public.certification_records
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

COMMENT ON COLUMN public.certification_records.reviewed_by IS
  'Admin (auth.users.id) who graded the written test for this record.';
COMMENT ON COLUMN public.certification_records.reviewed_at IS
  'When the written test was graded (admin_grade_short_answers).';

CREATE INDEX IF NOT EXISTS idx_certification_records_reviewed_by
  ON public.certification_records(reviewed_by);

-- Populate reviewed_by/reviewed_at in admin_grade_short_answers when creating/updating record
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
      expires_at,
      reviewed_by,
      reviewed_at
    ) VALUES (
      v_attempt.user_id,
      v_attempt.certification_type_id,
      p_attempt_id,
      now(),
      v_score,
      CASE WHEN v_has_practical THEN 'written_passed'::text ELSE 'active'::text END,
      now() + v_validity,
      auth.uid(),
      now()
    )
    ON CONFLICT (user_id, certification_type_id) WHERE (status IN ('pending', 'written_passed', 'active'))
    DO UPDATE SET
      written_attempt_id = EXCLUDED.written_attempt_id,
      written_passed_at = EXCLUDED.written_passed_at,
      written_score = EXCLUDED.written_score,
      status = EXCLUDED.status,
      expires_at = EXCLUDED.expires_at,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
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
  'Admin function to grade short_answer questions and finalize attempt. Sets reviewed_by/reviewed_at on certification_records.';

-- Recreate materialized view to expose reviewed_by, reviewed_at, reviewed_by_name
-- Drop dependent function first (returns SETOF this view).
DROP FUNCTION IF EXISTS public.get_user_certification_matrix(UUID, TEXT);
DROP MATERIALIZED VIEW IF EXISTS public.user_certification_matrix;
CREATE MATERIALIZED VIEW public.user_certification_matrix AS
SELECT
  u.user_id,
  u.full_name,
  u.role,
  ct.id AS certification_type_id,
  ct.name AS certification_name,
  cr.status,
  cr.expires_at,
  cr.reviewed_by,
  cr.reviewed_at,
  reviewer_au.full_name AS reviewed_by_name,
  CASE
    WHEN cr.status = 'active' AND cr.expires_at > now() THEN 'compliant'
    WHEN cr.status = 'active' AND cr.expires_at <= now() + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'non_compliant'
  END AS compliance_status
FROM public.app_users u
CROSS JOIN public.certification_types ct
LEFT JOIN public.certification_records cr
  ON cr.user_id = u.user_id AND cr.certification_type_id = ct.id
LEFT JOIN public.app_users reviewer_au ON reviewer_au.user_id = cr.reviewed_by
WHERE ct.is_active = true
  AND u.role IN ('employee', 'foreman', 'mechanic', 'general_foreman', 'safety_officer', 'manager');

CREATE UNIQUE INDEX ON public.user_certification_matrix (user_id, certification_type_id);
CREATE INDEX ON public.user_certification_matrix (certification_type_id);
CREATE INDEX ON public.user_certification_matrix (compliance_status);

COMMENT ON MATERIALIZED VIEW public.user_certification_matrix IS
  'User × cert compliance. Refresh daily. Includes reviewed_by/reviewed_at for admin UI.';

-- Recreate function that returns SETOF this view
CREATE OR REPLACE FUNCTION public.get_user_certification_matrix(
  p_cert_type_id UUID DEFAULT NULL,
  p_compliance_status TEXT DEFAULT NULL
)
RETURNS SETOF public.user_certification_matrix
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.user_certification_matrix m
  WHERE EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
  )
  AND (p_cert_type_id IS NULL OR m.certification_type_id = p_cert_type_id)
  AND (p_compliance_status IS NULL OR m.compliance_status = p_compliance_status);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_certification_matrix(UUID, TEXT) TO authenticated;
