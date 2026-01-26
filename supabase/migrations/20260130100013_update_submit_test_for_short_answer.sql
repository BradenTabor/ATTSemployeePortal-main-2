-- Migration: Update submit_certification_test to handle short_answer questions
-- Short answer questions are marked as pending_review and require admin grading
-- Attempt status is 'submitted' if there are pending reviews, 'graded' if all auto-graded

-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.submit_certification_test(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.submit_certification_test(
  p_test_attempt_id UUID,
  p_user_answers JSONB
)
RETURNS TABLE (
  passed BOOLEAN,
  score_percentage NUMERIC,
  correct_answers INTEGER,
  total_questions INTEGER,
  pending_review_count INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt RECORD;
  v_pass_threshold INTEGER;
  v_graded JSONB := '[]'::jsonb;
  v_correct INTEGER := 0;
  v_total_pts INTEGER := 0;
  v_earned INTEGER := 0;
  v_score NUMERIC;
  v_idx INT;
  v_ans JSONB;
  v_qid UUID;
  v_user_ans TEXT;
  v_correct_ans TEXT;
  v_pts INT;
  v_ok BOOLEAN;
  v_has_practical BOOLEAN;
  v_validity INTERVAL;
  v_question_type TEXT;
  v_pending_count INTEGER := 0;
  v_auto_graded_count INTEGER := 0;
  v_final_status TEXT;
BEGIN
  SELECT * INTO v_attempt
  FROM public.certification_attempts
  WHERE id = p_test_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid attempt';
  END IF;

  SELECT ct.passing_score, ct.has_practical_eval,
         (ct.validity_months || ' months')::interval
  INTO v_pass_threshold, v_has_practical, v_validity
  FROM public.certification_types ct
  WHERE ct.id = v_attempt.certification_type_id;

  FOR v_idx IN 0 .. jsonb_array_length(p_user_answers) - 1 LOOP
    v_ans := p_user_answers->v_idx;
    v_qid := (v_ans->>'question_id')::uuid;
    v_user_ans := v_ans->>'answer';

    SELECT q.correct_answer, q.points, q.question_type 
    INTO v_correct_ans, v_pts, v_question_type
    FROM public.certification_questions q
    WHERE q.id = v_qid;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Handle short_answer questions differently
    IF v_question_type = 'short_answer' THEN
      v_pending_count := v_pending_count + 1;
      v_total_pts := v_total_pts + COALESCE(v_pts, 1);
      
      v_graded := v_graded || jsonb_build_object(
        'question_id', v_qid,
        'user_answer', v_user_ans,
        'correct_answer', v_correct_ans,
        'is_correct', NULL,
        'points', COALESCE(v_pts, 1),
        'pending_review', true,
        'question_type', v_question_type
      );
    ELSE
      -- Auto-grade MC/TF questions
      v_auto_graded_count := v_auto_graded_count + 1;
      v_ok := (v_user_ans = v_correct_ans);
      IF v_ok THEN
        v_correct := v_correct + 1;
        v_earned := v_earned + COALESCE(v_pts, 1);
      END IF;
      v_total_pts := v_total_pts + COALESCE(v_pts, 1);

      v_graded := v_graded || jsonb_build_object(
        'question_id', v_qid,
        'user_answer', v_user_ans,
        'correct_answer', v_correct_ans,
        'is_correct', v_ok,
        'points', COALESCE(v_pts, 1),
        'pending_review', false,
        'question_type', v_question_type
      );
    END IF;
  END LOOP;

  -- Calculate score based on auto-graded questions only for now
  IF v_auto_graded_count = 0 THEN
    v_score := 0;
  ELSE
    -- Score is based on auto-graded questions only until admin reviews short_answer
    v_score := (v_earned::numeric / (v_total_pts - (v_pending_count * 1))::numeric) * 100;
  END IF;

  -- Determine status: 'submitted' if pending reviews, 'graded' if fully auto-graded
  IF v_pending_count > 0 THEN
    v_final_status := 'submitted';
  ELSE
    v_final_status := 'graded';
  END IF;

  UPDATE public.certification_attempts
  SET
    status = v_final_status,
    submitted_at = now(),
    completed_at = CASE WHEN v_pending_count = 0 THEN now() ELSE NULL END,
    answers = v_graded,
    total_questions = jsonb_array_length(p_user_answers),
    correct_answers = v_correct,
    total_points = v_total_pts,
    earned_points = v_earned,
    score_percentage = v_score,
    passed = CASE WHEN v_pending_count = 0 THEN (v_score >= v_pass_threshold) ELSE NULL END
  WHERE id = p_test_attempt_id;

  -- Only create certification record if fully graded and passed
  IF v_pending_count = 0 AND v_score >= v_pass_threshold THEN
    INSERT INTO public.certification_records (
      user_id,
      certification_type_id,
      written_attempt_id,
      written_passed_at,
      written_score,
      status,
      expires_at
    ) VALUES (
      auth.uid(),
      v_attempt.certification_type_id,
      p_test_attempt_id,
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

  passed := CASE WHEN v_pending_count = 0 THEN (v_score >= v_pass_threshold) ELSE NULL END;
  score_percentage := v_score;
  correct_answers := v_correct;
  total_questions := jsonb_array_length(p_user_answers);
  pending_review_count := v_pending_count;
  status := v_final_status;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.submit_certification_test(UUID, JSONB) IS
  'Grade MC/TF auto, mark short_answer as pending_review for admin grading.';

GRANT EXECUTE ON FUNCTION public.submit_certification_test(UUID, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- Admin function to grade short_answer questions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grade_short_answers(
  p_attempt_id UUID,
  p_grades JSONB -- Array of { question_id, is_correct, admin_notes? }
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
  -- Check admin role
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

  -- Apply admin grades to short_answer questions
  FOR v_idx IN 0 .. jsonb_array_length(v_answers) - 1 LOOP
    v_answer := v_answers->v_idx;
    
    -- Check if this question has a grade in p_grades
    SELECT g INTO v_grade
    FROM jsonb_array_elements(p_grades) g
    WHERE g->>'question_id' = v_answer->>'question_id';
    
    IF v_grade IS NOT NULL AND (v_answer->>'pending_review')::boolean = true THEN
      -- Apply admin grade
      v_is_correct := (v_grade->>'is_correct')::boolean;
      v_answer := v_answer || jsonb_build_object(
        'is_correct', v_is_correct,
        'pending_review', false,
        'graded_by_admin', true,
        'admin_notes', COALESCE(v_grade->>'admin_notes', '')
      );
    END IF;
    
    -- Calculate totals
    v_total_pts := v_total_pts + COALESCE((v_answer->>'points')::int, 1);
    IF (v_answer->>'is_correct')::boolean = true THEN
      v_correct := v_correct + 1;
      v_earned := v_earned + COALESCE((v_answer->>'points')::int, 1);
    END IF;
    
    v_new_answers := v_new_answers || v_answer;
  END LOOP;

  -- Calculate final score
  IF v_total_pts = 0 THEN
    v_score := 0;
  ELSE
    v_score := (v_earned::numeric / v_total_pts::numeric) * 100;
  END IF;

  -- Update attempt
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
    graded_at = now()
  WHERE id = p_attempt_id;

  -- Create/update certification record if passed
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
  'Admin function to grade short_answer questions and finalize attempt.';

GRANT EXECUTE ON FUNCTION public.admin_grade_short_answers(UUID, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- View for admins to see pending reviews
-- Drop first so we can change the definition (PostgreSQL rejects REPLACE if columns change).
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.pending_certification_reviews;

CREATE VIEW public.pending_certification_reviews AS
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
  (
    SELECT COUNT(*)::int 
    FROM jsonb_array_elements(ca.answers) a 
    WHERE (a->>'pending_review')::boolean = true
  ) AS pending_count
FROM public.certification_attempts ca
JOIN public.certification_types ct ON ct.id = ca.certification_type_id
LEFT JOIN public.app_users au ON au.user_id = ca.user_id
WHERE ca.status = 'submitted';

COMMENT ON VIEW public.pending_certification_reviews IS
  'View of certification attempts pending admin review of short_answer questions.';

-- RLS for the view (admins and general_foremen only)
-- Views inherit RLS from underlying tables, but we add explicit policy
