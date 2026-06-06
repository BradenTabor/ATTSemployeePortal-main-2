-- =============================================================================
-- Points System v2 — Phase 2: Earning Sources
-- - point_rules table + get_point_rule / insert_point_transaction helpers
-- - Near-miss base (+10, daily cap) and corrective bonus (+15)
-- - Certification pass (+20) and early renewal (+10)
-- - Extended idempotency index: (source, reference_id, category) NULLS NOT DISTINCT
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: point_rules
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      public.point_source NOT NULL,
  rule_key    text NOT NULL,
  points      integer NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT point_rules_source_rule_key_unique UNIQUE (source, rule_key)
);

COMMENT ON TABLE public.point_rules IS
  'Configurable point amounts and caps per earning source. points column holds award '
  'amounts; rule_key ending in _cap stores a daily/count limit (not wallet points).';

COMMENT ON COLUMN public.point_rules.points IS
  'Award amount for *_amount rules; limit value for *_cap rules (semantic overload, v1).';

ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read point rules" ON public.point_rules;
CREATE POLICY "Authenticated read point rules"
  ON public.point_rules FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage point rules" ON public.point_rules;
CREATE POLICY "Admins manage point rules"
  ON public.point_rules FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role full access point rules" ON public.point_rules;
CREATE POLICY "Service role full access point rules"
  ON public.point_rules FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed earning rules (idempotent)
INSERT INTO public.point_rules (source, rule_key, points, description)
VALUES
  ('near_miss_report', 'base_amount', 10,
   'Points per near-miss incident filed (category=base)'),
  ('near_miss_report', 'base_daily_cap', 2,
   'Max base near-miss awards per reporter per calendar day (America/Chicago)'),
  ('near_miss_report', 'corrective_bonus_amount', 15,
   'One-time bonus when a near-miss CAPA reaches verified (category=corrective_bonus)'),
  ('certification', 'pass_amount', 20,
   'Points when a certification record becomes active (category=pass)'),
  ('certification', 'early_renewal_amount', 10,
   'Bonus for early renewal while cert still active and unexpired (category=early_renewal)')
ON CONFLICT (source, rule_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- HELPERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_point_rule(
  p_source public.point_source,
  p_rule_key text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT points
  FROM public.point_rules
  WHERE source = p_source
    AND rule_key = p_rule_key
    AND is_active = true;
$$;

COMMENT ON FUNCTION public.get_point_rule(public.point_source, text) IS
  'Returns configured points/cap for an active rule, or NULL if missing/inactive (caller skips award).';

GRANT EXECUTE ON FUNCTION public.get_point_rule(public.point_source, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.insert_point_transaction(
  p_user_id             uuid,
  p_amount              integer,
  p_source              public.point_source,
  p_reference_id        uuid,
  p_reference_table     text,
  p_category            text DEFAULT NULL,
  p_counts_toward_raffle boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, category, counts_toward_raffle)
  VALUES
    (p_user_id, p_amount, p_source, p_reference_id, p_reference_table, p_category, p_counts_toward_raffle)
  ON CONFLICT (source, reference_id, category)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.insert_point_transaction(uuid, integer, public.point_source, uuid, text, text, boolean) IS
  'Idempotent ledger insert for automatic earning sources; ON CONFLICT matches uq_point_tx_source_ref.';

ALTER FUNCTION public.insert_point_transaction(uuid, integer, public.point_source, uuid, text, text, boolean) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- IDEMPOTENCY INDEX: extend with category, NULLS NOT DISTINCT
-- Replaces uq_point_tx_source_ref in a single transaction (no coverage gap).
-- NULLS NOT DISTINCT preserves dedupe for existing NULL-category rows
-- (announcement_claim / compliance_form) while allowing pass/early_renewal coexistence.
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.uq_point_tx_source_ref;

CREATE UNIQUE INDEX uq_point_tx_source_ref
  ON public.point_transactions(source, reference_id, category)
  NULLS NOT DISTINCT
  WHERE reference_id IS NOT NULL
    AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report');

-- -----------------------------------------------------------------------------
-- Update dual-write triggers to match extended index (include category in ON CONFLICT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_announcement_reward_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.points_awarded = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
  VALUES
    (NEW.user_id, NEW.points_awarded, 'announcement_claim', NEW.id, 'announcement_rewards', true, NEW.claimed_at)
  ON CONFLICT (source, reference_id, category)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_compliance_reward_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.points_awarded = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
  VALUES
    (NEW.user_id, NEW.points_awarded, 'compliance_form', NEW.id, 'compliance_rewards', true, NEW.awarded_at)
  ON CONFLICT (source, reference_id, category)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_announcement_reward_to_ledger() OWNER TO postgres;
ALTER FUNCTION public.sync_compliance_reward_to_ledger() OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- TRIGGER: near-miss base award on safety_incidents INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_near_miss_base_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount   integer;
  v_cap      integer;
  v_today    integer;
BEGIN
  IF NEW.severity IS DISTINCT FROM 'near_miss' THEN
    RETURN NEW;
  END IF;

  IF NEW.reported_by IS NULL THEN
    RAISE NOTICE 'near_miss base award skipped: incident % has NULL reported_by', NEW.id;
    RETURN NEW;
  END IF;

  v_amount := public.get_point_rule('near_miss_report', 'base_amount');
  IF v_amount IS NULL THEN
    RETURN NEW;
  END IF;

  v_cap := public.get_point_rule('near_miss_report', 'base_daily_cap');
  IF v_cap IS NOT NULL THEN
    SELECT count(*)::integer INTO v_today
    FROM public.point_transactions
    WHERE user_id = NEW.reported_by
      AND source = 'near_miss_report'
      AND category = 'base'
      AND EXTRACT(YEAR  FROM (created_at AT TIME ZONE 'America/Chicago')) =
          EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Chicago'))
      AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'America/Chicago')) =
          EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'))
      AND EXTRACT(DAY   FROM (created_at AT TIME ZONE 'America/Chicago')) =
          EXTRACT(DAY   FROM (now() AT TIME ZONE 'America/Chicago'));

    IF v_today >= v_cap THEN
      RAISE NOTICE 'near_miss base award suppressed for user %: daily cap % reached (% today)',
        NEW.reported_by, v_cap, v_today;
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.insert_point_transaction(
    NEW.reported_by,
    v_amount,
    'near_miss_report',
    NEW.id,
    'safety_incidents',
    'base',
    true
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.award_near_miss_base_points() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_award_near_miss_base_points ON public.safety_incidents;
CREATE TRIGGER trg_award_near_miss_base_points
  AFTER INSERT ON public.safety_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.award_near_miss_base_points();

-- -----------------------------------------------------------------------------
-- TRIGGER: corrective bonus on corrective_actions verified
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_near_miss_corrective_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount    integer;
  v_incident  record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;

  IF NEW.incident_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, severity, reported_by
  INTO v_incident
  FROM public.safety_incidents
  WHERE id = NEW.incident_id;

  IF NOT FOUND OR v_incident.severity IS DISTINCT FROM 'near_miss' THEN
    RETURN NEW;
  END IF;

  IF v_incident.reported_by IS NULL THEN
    RAISE NOTICE 'near_miss corrective bonus skipped: incident % has NULL reported_by', v_incident.id;
    RETURN NEW;
  END IF;

  -- One corrective bonus per incident (first verified CAPA only)
  IF EXISTS (
    SELECT 1
    FROM public.point_transactions pt
    JOIN public.corrective_actions ca ON ca.id = pt.reference_id
    WHERE pt.source = 'near_miss_report'
      AND pt.category = 'corrective_bonus'
      AND ca.incident_id = NEW.incident_id
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := public.get_point_rule('near_miss_report', 'corrective_bonus_amount');
  IF v_amount IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.insert_point_transaction(
    v_incident.reported_by,
    v_amount,
    'near_miss_report',
    NEW.id,
    'corrective_actions',
    'corrective_bonus',
    true
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.award_near_miss_corrective_bonus() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_award_near_miss_corrective_bonus ON public.corrective_actions;
CREATE TRIGGER trg_award_near_miss_corrective_bonus
  AFTER UPDATE ON public.corrective_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_near_miss_corrective_bonus();

-- -----------------------------------------------------------------------------
-- TRIGGER: certification pass + early renewal on certification_records active
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_certification_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount        integer;
  v_category      text;
  v_completing_id uuid;
  v_has_practical boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT has_practical_eval INTO v_has_practical
  FROM public.certification_types
  WHERE id = NEW.certification_type_id;

  IF COALESCE(v_has_practical, false) AND NEW.practical_evaluation_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_completing_id := COALESCE(NEW.practical_evaluation_id, NEW.written_attempt_id);
  IF v_completing_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND OLD.expires_at > now() THEN
    v_category := 'early_renewal';
    v_amount := public.get_point_rule('certification', 'early_renewal_amount');
  ELSIF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active') THEN
    v_category := 'pass';
    v_amount := public.get_point_rule('certification', 'pass_amount');
  ELSE
    RETURN NEW;
  END IF;

  IF v_amount IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.insert_point_transaction(
    NEW.user_id,
    v_amount,
    'certification',
    v_completing_id,
    'certification_records',
    v_category,
    true
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.award_certification_points() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_award_certification_points ON public.certification_records;
CREATE TRIGGER trg_award_certification_points
  AFTER INSERT OR UPDATE OF status, practical_evaluation_id, written_attempt_id, expires_at
  ON public.certification_records
  FOR EACH ROW
  EXECUTE FUNCTION public.award_certification_points();
