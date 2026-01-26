-- =============================================================================
-- Fix: Handle division by zero in score calculation when all questions are short_answer
-- Also ensure better error messages
-- =============================================================================

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
  v_auto_graded_pts INTEGER := 0;
  v_final_status TEXT;
BEGIN
  -- Validate input
  IF p_user_answers IS NULL OR jsonb_array_length(p_user_answers) = 0 THEN
    RAISE EXCEPTION 'No answers provided';
  END IF;

  SELECT * INTO v_attempt
  FROM public.certification_attempts
  WHERE id = p_test_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid attempt or attempt not in progress. You may have already submitted this test.';
  END IF;

  SELECT ct.passing_score, ct.has_practical_eval,
         (ct.validity_months || ' months')::interval
  INTO v_pass_threshold, v_has_practical, v_validity
  FROM public.certification_types ct
  WHERE ct.id = v_attempt.certification_type_id;

  IF v_pass_threshold IS NULL THEN
    RAISE EXCEPTION 'Certification configuration error: no passing score set';
  END IF;

  FOR v_idx IN 0 .. jsonb_array_length(p_user_answers) - 1 LOOP
    v_ans := p_user_answers->v_idx;
    v_qid := (v_ans->>'question_id')::uuid;
    v_user_ans := COALESCE(v_ans->>'answer', '');

    SELECT q.correct_answer, q.points, q.question_type 
    INTO v_correct_ans, v_pts, v_question_type
    FROM public.certification_questions q
    WHERE q.id = v_qid;

    IF NOT FOUND THEN
      RAISE NOTICE 'Question % not found, skipping', v_qid;
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
      v_auto_graded_pts := v_auto_graded_pts + COALESCE(v_pts, 1);
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

  -- Calculate score based on auto-graded questions only
  IF v_auto_graded_pts = 0 THEN
    -- All questions are short_answer, score will be determined after admin review
    v_score := 0;
  ELSE
    v_score := (v_earned::numeric / v_auto_graded_pts::numeric) * 100;
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
  'Grade MC/TF auto, mark short_answer as pending_review for admin grading. Fixed division by zero.';
