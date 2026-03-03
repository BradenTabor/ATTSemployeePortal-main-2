-- Certification audit log: grade submission, qualification level change, cert access grant/revoke.
-- RLS: admin and safety_officer can SELECT; inserts only via SECURITY DEFINER helper (no authenticated INSERT policy).

CREATE TABLE IF NOT EXISTS public.certification_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.certification_audit_log IS
  'Audit trail for certification grading, qualification level changes, and cert type access grant/revoke.';
COMMENT ON COLUMN public.certification_audit_log.actor_id IS 'User (auth.users.id) who performed the action.';
COMMENT ON COLUMN public.certification_audit_log.action IS 'Action type: grade_submission, qualification_level_change, cert_access_grant, cert_access_revoke.';
COMMENT ON COLUMN public.certification_audit_log.record_id IS 'Target record (e.g. attempt id, grant id, user_id for qualification).';

ALTER TABLE public.certification_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admin and safety_officer can read
DROP POLICY IF EXISTS "certification_audit_log_admin_safety_officer_select" ON public.certification_audit_log;
CREATE POLICY "certification_audit_log_admin_safety_officer_select"
  ON public.certification_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role IN ('admin', 'safety_officer')
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated; writes only via SECURITY DEFINER helper (service role / definer)

CREATE INDEX IF NOT EXISTS idx_certification_audit_log_created_at
  ON public.certification_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certification_audit_log_actor_id
  ON public.certification_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_certification_audit_log_action
  ON public.certification_audit_log(action);

-- Helper: insert one audit row (SECURITY DEFINER so it bypasses RLS)
CREATE OR REPLACE FUNCTION public.insert_certification_audit_log(
  p_actor_id uuid,
  p_action text,
  p_record_id uuid,
  p_old_value jsonb,
  p_new_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.certification_audit_log (actor_id, action, record_id, old_value, new_value)
  VALUES (p_actor_id, p_action, p_record_id, p_old_value, p_new_value);
END;
$$;

COMMENT ON FUNCTION public.insert_certification_audit_log(uuid, text, uuid, jsonb, jsonb) IS
  'Append one row to certification_audit_log. Call from triggers/RPCs only; bypasses RLS.';

-- Revoke execute from public; only called from other definer functions / triggers
REVOKE EXECUTE ON FUNCTION public.insert_certification_audit_log(uuid, text, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_certification_audit_log(uuid, text, uuid, jsonb, jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.insert_certification_audit_log(uuid, text, uuid, jsonb, jsonb) TO service_role;

-- Trigger: cert access revoke (DELETE on certification_access_grants)
CREATE OR REPLACE FUNCTION public.certification_audit_log_on_revoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.insert_certification_audit_log(
    auth.uid(),
    'cert_access_revoke',
    OLD.id,
    jsonb_build_object(
      'user_id', OLD.user_id,
      'certification_type_id', OLD.certification_type_id,
      'granted_by', OLD.granted_by,
      'granted_at', OLD.granted_at
    ),
    NULL
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_certification_audit_log_access_revoke ON public.certification_access_grants;
CREATE TRIGGER trigger_certification_audit_log_access_revoke
  AFTER DELETE ON public.certification_access_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.certification_audit_log_on_revoke();

-- Trigger: qualification level change (UPDATE on app_users)
CREATE OR REPLACE FUNCTION public.certification_audit_log_on_qualification_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.electrical_qualification_level IS DISTINCT FROM NEW.electrical_qualification_level THEN
    PERFORM public.insert_certification_audit_log(
      auth.uid(),
      'qualification_level_change',
      NEW.user_id,
      to_jsonb(COALESCE(OLD.electrical_qualification_level, 'unqualified')),
      to_jsonb(COALESCE(NEW.electrical_qualification_level, 'unqualified'))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_certification_audit_log_qualification_change ON public.app_users;
CREATE TRIGGER trigger_certification_audit_log_qualification_change
  AFTER UPDATE ON public.app_users
  FOR EACH ROW
  WHEN (OLD.electrical_qualification_level IS DISTINCT FROM NEW.electrical_qualification_level)
  EXECUTE FUNCTION public.certification_audit_log_on_qualification_change();

-- Audit from grant_certification_access (cert type access grant).
-- SECURITY DEFINER so it can call insert_certification_audit_log (no EXECUTE for authenticated on helper).
CREATE OR REPLACE FUNCTION public.grant_certification_access(
  p_user_id UUID,
  p_certification_type_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id uuid;
  v_row jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can grant certification access';
  END IF;

  INSERT INTO public.certification_access_grants (
    user_id,
    certification_type_id,
    granted_by,
    granted_at
  ) VALUES (
    p_user_id,
    p_certification_type_id,
    auth.uid(),
    now()
  )
  ON CONFLICT (user_id, certification_type_id) DO NOTHING
  RETURNING id INTO v_grant_id;

  IF v_grant_id IS NOT NULL THEN
    v_row := jsonb_build_object(
      'id', v_grant_id,
      'user_id', p_user_id,
      'certification_type_id', p_certification_type_id,
      'granted_by', auth.uid(),
      'granted_at', now()
    );
    PERFORM public.insert_certification_audit_log(
      auth.uid(),
      'cert_access_grant',
      v_grant_id,
      NULL,
      v_row
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.grant_certification_access(UUID, UUID) IS
  'Admin only: grant a user access to a certification test and study guide. Writes to certification_audit_log.';

GRANT EXECUTE ON FUNCTION public.grant_certification_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_certification_access(UUID, UUID) TO service_role;

-- Audit from admin_grade_short_answers (grade submission)
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
  v_old_json jsonb;
  v_new_json jsonb;
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

  v_old_json := jsonb_build_object(
    'attempt_id', v_attempt.id,
    'user_id', v_attempt.user_id,
    'certification_type_id', v_attempt.certification_type_id,
    'status', v_attempt.status,
    'submitted_at', v_attempt.submitted_at
  );

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

  v_new_json := jsonb_build_object(
    'attempt_id', p_attempt_id,
    'score_percentage', v_score,
    'passed', (v_score >= v_pass_threshold),
    'correct_answers', v_correct,
    'total_questions', jsonb_array_length(v_new_answers)
  );
  PERFORM public.insert_certification_audit_log(
    auth.uid(),
    'grade_submission',
    p_attempt_id,
    v_old_json,
    v_new_json
  );

  passed := (v_score >= v_pass_threshold);
  score_percentage := v_score;
  correct_answers := v_correct;
  total_questions := jsonb_array_length(v_new_answers);
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.admin_grade_short_answers(UUID, JSONB) IS
  'Admin/General Foreman grade short_answer questions and finalize attempt. Writes to certification_audit_log.';
