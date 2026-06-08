-- =============================================================================
-- Config-lock assertions — pin only values that behavioral tests depend on.
--
-- Criterion: if a wrong value here would make a behavioral assertion pass while
-- prod behavior is wrong (or fail while prod is right), lock it. Do NOT assert
-- every row in config_tables.txt; prod_config_data.sql is the full snapshot.
-- =============================================================================

DO $$
DECLARE
  missing text := '';
  v_points integer;
  v_cap    integer;
BEGIN
  -- Near-miss earning triggers (assertions.sql cap/balance matrix)
  SELECT points INTO v_points FROM public.point_rules
   WHERE source = 'near_miss_report' AND rule_key = 'base_amount' AND is_active;
  IF v_points IS DISTINCT FROM 10 THEN
    missing := missing || format(E'\n  - near_miss_report.base_amount = %s (expected 10)', v_points);
  END IF;

  SELECT points INTO v_cap FROM public.point_rules
   WHERE source = 'near_miss_report' AND rule_key = 'base_daily_cap' AND is_active;
  IF v_cap IS DISTINCT FROM 2 THEN
    missing := missing || format(E'\n  - near_miss_report.base_daily_cap = %s (expected 2)', v_cap);
  END IF;

  SELECT points INTO v_points FROM public.point_rules
   WHERE source = 'near_miss_report' AND rule_key = 'corrective_bonus_amount' AND is_active;
  IF v_points IS DISTINCT FROM 15 THEN
    missing := missing || format(E'\n  - near_miss_report.corrective_bonus_amount = %s (expected 15)', v_points);
  END IF;

  -- Certification earning triggers (assertions.sql balance = 50 fixture)
  SELECT points INTO v_points FROM public.point_rules
   WHERE source = 'certification' AND rule_key = 'pass_amount' AND is_active;
  IF v_points IS DISTINCT FROM 20 THEN
    missing := missing || format(E'\n  - certification.pass_amount = %s (expected 20)', v_points);
  END IF;

  SELECT points INTO v_points FROM public.point_rules
   WHERE source = 'certification' AND rule_key = 'early_renewal_amount' AND is_active;
  IF v_points IS DISTINCT FROM 10 THEN
    missing := missing || format(E'\n  - certification.early_renewal_amount = %s (expected 10)', v_points);
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — config-lock point_rules mismatch (update migration + re-baseline, or fix assertion if intentional):%', missing
      USING HINT = 'Config changes must go through migrations; see docs/CONVENTIONS.md';
  END IF;
  RAISE NOTICE 'OK: config-lock point_rules — near-miss base/cap/bonus and cert pass/renewal amounts match behavioral fixtures.';
END $$;

DO $$
DECLARE
  missing text := '';
  r record;
BEGIN
  -- Redemption store behavioral matrix fixture rows (IDs hard-coded in assertions.sql)
  FOR r IN
    SELECT * FROM (VALUES
      ('a1000001-0000-4000-8000-000000000001'::uuid, 75,  NULL::integer, true),
      ('a1000001-0000-4000-8000-000000000006'::uuid, 400, 12,            true),
      ('a1000001-0000-4000-8000-000000000007'::uuid, 500, NULL::integer, true)
    ) AS t(id, point_cost, stock_qty, is_active)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.reward_catalog rc
      WHERE rc.id = r.id
        AND rc.point_cost = r.point_cost
        AND rc.is_active = r.is_active
        AND rc.stock_qty IS NOT DISTINCT FROM r.stock_qty
    ) THEN
      missing := missing || format(
        E'\n  - reward_catalog %s (expected cost=%s stock=%s active=%s)',
        r.id, r.point_cost, r.stock_qty, r.is_active
      );
    END IF;
  END LOOP;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — config-lock reward_catalog fixture mismatch:%', missing
      USING HINT = 'Seed catalog rows via migration; re-baseline prod_config_data.sql after prod apply.';
  END IF;
  RAISE NOTICE 'OK: config-lock reward_catalog — cap/hoodie/gift-card fixture rows present with expected cost/stock.';
END $$;
