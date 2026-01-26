-- =============================================================================
-- Certification System — RPC Functions
-- =============================================================================
-- Secure test delivery (no answer leakage), grading, 24h cooldown, stratified
-- question selection. All SECURITY DEFINER, search_path = public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- can_start_certification_attempt
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_start_certification_attempt(
  p_cert_type_id UUID,
  p_check_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  can_start BOOLEAN,
  reason TEXT,
  next_available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_attempt RECORD;
  cooldown_ends TIMESTAMPTZ;
BEGIN
  IF p_check_user_id IS NULL THEN
    can_start := false;
    reason := 'Not authenticated';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT ca.*
  INTO last_attempt
  FROM public.certification_attempts ca
  WHERE ca.user_id = p_check_user_id
    AND ca.certification_type_id = p_cert_type_id
    AND ca.status = 'graded'
  ORDER BY ca.completed_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    can_start := true;
    reason := 'No previous attempts';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF last_attempt.passed THEN
    can_start := true;
    reason := 'Previous attempt passed';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  cooldown_ends := last_attempt.completed_at + INTERVAL '24 hours';
  IF now() < cooldown_ends THEN
    can_start := false;
    reason := 'Must wait 24 hours after failed attempt';
    next_available_at := cooldown_ends;
    RETURN NEXT;
    RETURN;
  END IF;

  can_start := true;
  reason := 'Cooldown period passed';
  next_available_at := NULL;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.can_start_certification_attempt(UUID, UUID) IS
  'Check if user can start a new attempt. 24h cooldown after failure.';

-- -----------------------------------------------------------------------------
-- create_certification_attempt
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_certification_attempt(p_cert_type_slug TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert_id UUID;
  v_can_start BOOLEAN;
  v_reason TEXT;
  v_next_attempt INTEGER;
  v_new_id UUID;
BEGIN
  SELECT id INTO v_cert_id
  FROM public.certification_types
  WHERE slug = p_cert_type_slug AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification type not found';
  END IF;

  SELECT cs.can_start, cs.reason INTO v_can_start, v_reason
  FROM public.can_start_certification_attempt(v_cert_id, auth.uid()) cs;

  IF NOT v_can_start THEN
    RAISE EXCEPTION '%', v_reason;
  END IF;

  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_next_attempt
  FROM public.certification_attempts
  WHERE user_id = auth.uid() AND certification_type_id = v_cert_id;

  INSERT INTO public.certification_attempts (
    user_id,
    certification_type_id,
    attempt_number,
    status,
    started_at
  ) VALUES (
    auth.uid(),
    v_cert_id,
    v_next_attempt,
    'in_progress',
    now()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.create_certification_attempt(TEXT) IS
  'Create in-progress attempt after cooldown check. Returns attempt id.';

-- -----------------------------------------------------------------------------
-- get_certification_test_questions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_certification_test_questions(
  p_cert_type_slug TEXT,
  p_test_attempt_id UUID
)
RETURNS TABLE (
  question_id UUID,
  question_number INTEGER,
  question_text TEXT,
  question_type TEXT,
  options JSONB,
  points INTEGER,
  category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert RECORD;
  v_q TEXT;
  v_cat_key TEXT;
  v_cat_prop NUMERIC;
  v_limit_per_cat INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.certification_attempts
    WHERE id = p_test_attempt_id
      AND user_id = auth.uid()
      AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Invalid attempt or attempt not in progress';
  END IF;

  SELECT * INTO v_cert
  FROM public.certification_types
  WHERE slug = p_cert_type_slug AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification type not found';
  END IF;

  IF v_cert.question_count IS NULL OR v_cert.question_count < 1 THEN
    RAISE EXCEPTION 'Certification has no question_count configured';
  END IF;

  IF v_cert.question_categories IS NULL OR v_cert.question_categories = '{}'::jsonb THEN
    RETURN QUERY
    SELECT
      q.id AS question_id,
      q.question_number,
      q.question_text,
      q.question_type,
      q.options,
      q.points,
      q.category
    FROM public.certification_questions q
    WHERE q.certification_type_id = v_cert.id AND q.is_active = true
    ORDER BY random()
    LIMIT v_cert.question_count;
    RETURN;
  END IF;

  v_q := '';
  FOR v_cat_key, v_cat_prop IN
    SELECT t.k, (t.v::text)::numeric
    FROM jsonb_each_text(v_cert.question_categories) AS t(k, v)
  LOOP
    v_limit_per_cat := GREATEST(1, CEIL(v_cert.question_count * v_cat_prop));
    IF v_q <> '' THEN
      v_q := v_q || ' UNION ALL ';
    END IF;
    v_q := v_q || format(
      $f$(
        SELECT q.id AS question_id, q.question_number, q.question_text, q.question_type, q.options, q.points, q.category
        FROM public.certification_questions q
        WHERE q.certification_type_id = %L AND q.is_active = true AND q.category = %L
        ORDER BY random()
        LIMIT %s
      )$f$,
      v_cert.id,
      v_cat_key,
      v_limit_per_cat
    );
  END LOOP;

  IF v_q = '' THEN
    RETURN QUERY
    SELECT
      q.id AS question_id,
      q.question_number,
      q.question_text,
      q.question_type,
      q.options,
      q.points,
      q.category
    FROM public.certification_questions q
    WHERE q.certification_type_id = v_cert.id AND q.is_active = true
    ORDER BY random()
    LIMIT v_cert.question_count;
    RETURN;
  END IF;

  RETURN QUERY
  EXECUTE format(
    'SELECT sq.question_id, sq.question_number, sq.question_text, sq.question_type, sq.options, sq.points, sq.category FROM (%s) sq ORDER BY random() LIMIT %s',
    v_q,
    v_cert.question_count
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- submit_certification_test
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_certification_test(
  p_test_attempt_id UUID,
  p_user_answers JSONB
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

    SELECT q.correct_answer, q.points INTO v_correct_ans, v_pts
    FROM public.certification_questions q
    WHERE q.id = v_qid;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

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
      'points', COALESCE(v_pts, 1)
    );
  END LOOP;

  IF v_total_pts = 0 THEN
    v_score := 0;
  ELSE
    v_score := (v_earned::numeric / v_total_pts::numeric) * 100;
  END IF;

  UPDATE public.certification_attempts
  SET
    status = 'graded',
    submitted_at = now(),
    completed_at = now(),
    answers = v_graded,
    total_questions = jsonb_array_length(p_user_answers),
    correct_answers = v_correct,
    total_points = v_total_pts,
    earned_points = v_earned,
    score_percentage = v_score,
    passed = (v_score >= v_pass_threshold)
  WHERE id = p_test_attempt_id;

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

  passed := (v_score >= v_pass_threshold);
  score_percentage := v_score;
  correct_answers := v_correct;
  total_questions := jsonb_array_length(p_user_answers);
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.submit_certification_test(UUID, JSONB) IS
  'Grade MC/TF only, update attempt, optionally create/update cert record.';

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.can_start_certification_attempt(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_certification_attempt(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_certification_test_questions(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_certification_test(UUID, JSONB) TO authenticated;
