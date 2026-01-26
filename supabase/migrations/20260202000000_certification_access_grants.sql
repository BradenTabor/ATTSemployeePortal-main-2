-- =============================================================================
-- Certification Access Grants — Per-user, per-certification access control
-- =============================================================================
-- When no grants exist for a cert, everyone (authenticated) can access.
-- When at least one grant exists, only grantees and admins can access tests
-- and study guides for that cert. Safety Resources remain public.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: certification_access_grants
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certification_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certification_type_id UUID NOT NULL REFERENCES public.certification_types(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, certification_type_id)
);

COMMENT ON TABLE public.certification_access_grants IS
  'Grants access to a certification test and study guide. No rows for a cert = open to all; any row = restricted to grantees and admins.';

CREATE INDEX idx_cert_access_grants_cert_id
  ON public.certification_access_grants(certification_type_id);

CREATE INDEX idx_cert_access_grants_user_cert
  ON public.certification_access_grants(user_id, certification_type_id);

ALTER TABLE public.certification_access_grants ENABLE ROW LEVEL SECURITY;

-- Only admins can see and manage grants
DROP POLICY IF EXISTS "cert_access_grants_admin_select" ON public.certification_access_grants;
CREATE POLICY "cert_access_grants_admin_select"
  ON public.certification_access_grants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "cert_access_grants_admin_insert" ON public.certification_access_grants;
CREATE POLICY "cert_access_grants_admin_insert"
  ON public.certification_access_grants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "cert_access_grants_admin_delete" ON public.certification_access_grants;
CREATE POLICY "cert_access_grants_admin_delete"
  ON public.certification_access_grants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- Helper: user_has_certification_access
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_certification_access(
  p_user_id UUID,
  p_certification_type_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_any_grant BOOLEAN;
  v_has_user_grant BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_certification_type_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.certification_access_grants
    WHERE certification_type_id = p_certification_type_id
  ) INTO v_has_any_grant;

  IF NOT v_has_any_grant THEN
    RETURN true;  -- no grants => open to everyone
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.certification_access_grants
    WHERE certification_type_id = p_certification_type_id
      AND user_id = p_user_id
  ) INTO v_has_user_grant;

  RETURN v_has_user_grant;
END;
$$;

COMMENT ON FUNCTION public.user_has_certification_access(UUID, UUID) IS
  'True if user may access this certification (test + study guide). Admins and users with a grant always; everyone if no grants for cert.';

-- -----------------------------------------------------------------------------
-- RLS: certification_types SELECT (replace cert_types_select_active)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "cert_types_select_active" ON public.certification_types;

CREATE POLICY "cert_types_select_by_access"
  ON public.certification_types FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND public.user_has_certification_access(auth.uid(), id)
  );

-- -----------------------------------------------------------------------------
-- RPC: can_start_certification_attempt — add access check
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

  IF NOT public.user_has_certification_access(p_check_user_id, p_cert_type_id) THEN
    can_start := false;
    reason := 'You do not have access to this certification. Contact an administrator.';
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

-- -----------------------------------------------------------------------------
-- RPC: create_certification_attempt — add access check
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

  IF NOT public.user_has_certification_access(auth.uid(), v_cert_id) THEN
    RAISE EXCEPTION 'CERTIFICATION_ACCESS_DENIED: You do not have access to this certification. Contact an administrator.';
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

-- -----------------------------------------------------------------------------
-- RPC: get_certification_test_questions — add access check
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
  v_attempt_cert_id UUID;
  v_q TEXT;
  v_cat_key TEXT;
  v_cat_prop NUMERIC;
  v_limit_per_cat INTEGER;
BEGIN
  SELECT certification_type_id INTO v_attempt_cert_id
  FROM public.certification_attempts
  WHERE id = p_test_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF v_attempt_cert_id IS NULL THEN
    RAISE EXCEPTION 'Invalid attempt or attempt not in progress';
  END IF;

  IF NOT public.user_has_certification_access(auth.uid(), v_attempt_cert_id) THEN
    RAISE EXCEPTION 'CERTIFICATION_ACCESS_DENIED: You do not have access to this certification. Contact an administrator.';
  END IF;

  SELECT * INTO v_cert
  FROM public.certification_types
  WHERE slug = p_cert_type_slug AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification type not found';
  END IF;

  IF v_cert.id IS DISTINCT FROM v_attempt_cert_id THEN
    RAISE EXCEPTION 'Attempt does not match certification';
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
-- RPC: grant_certification_access (sets granted_by = auth.uid())
-- SECURITY INVOKER so the INSERT runs as the caller and RLS allows it for admins.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_certification_access(
  p_user_id UUID,
  p_certification_type_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
  ON CONFLICT (user_id, certification_type_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.grant_certification_access(UUID, UUID) IS
  'Admin only: grant a user access to a certification test and study guide.';

GRANT EXECUTE ON FUNCTION public.grant_certification_access(UUID, UUID) TO authenticated;
