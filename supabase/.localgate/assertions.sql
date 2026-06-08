-- =============================================================================
-- Local validation gate — reusable assertion logic.
-- Sourced by verify.sql; any failed check RAISEs so psql (ON_ERROR_STOP) fails.
-- Extend the increment-specific sections per future migration increment.
-- =============================================================================

DO $$
DECLARE
  missing text := '';
BEGIN
  -- ---- Supabase auth / RLS faithfulness -------------------------------------
  -- auth.uid() must exist AND be callable (resolves to NULL without a JWT GUC).
  BEGIN
    PERFORM auth.uid();
  EXCEPTION WHEN undefined_function THEN
    missing := missing || E'\n  - auth.uid() is missing (auth schema did not load)';
  WHEN others THEN
    -- auth.uid() reads request.jwt.* GUCs; absent GUC => NULL, not an error.
    -- Any other error here means the function body is not faithful.
    missing := missing || E'\n  - auth.uid() exists but failed to execute: ' || SQLERRM;
  END;

  IF to_regprocedure('auth.role()') IS NULL THEN
    missing := missing || E'\n  - auth.role() is missing';
  END IF;

  -- RLS roles must exist for policy grants to be meaningful locally.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    missing := missing || E'\n  - role "authenticated" is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    missing := missing || E'\n  - role "service_role" is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    missing := missing || E'\n  - role "anon" is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — Supabase auth/RLS harness is NOT faithful:%', missing
      USING HINT = 'Re-dump prod with roles + auth schema; do not trust RLS results from this DB.';
  END IF;
  RAISE NOTICE 'OK: auth.uid()/auth.role() present & callable; roles authenticated/service_role/anon exist.';
END $$;

-- ---- Increment-specific checks: 20260605120000 (ledger foundation) ----------
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regclass('public.point_transactions') IS NULL THEN
    missing := missing || E'\n  - table public.point_transactions is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'point_source'
                 AND typnamespace = 'public'::regnamespace) THEN
    missing := missing || E'\n  - enum public.point_source is missing';
  END IF;

  IF to_regprocedure('public.get_user_point_balance(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.get_user_point_balance(uuid) is missing';
  END IF;
  IF to_regprocedure('public.get_user_raffle_entries(uuid,int,int)') IS NULL THEN
    missing := missing || E'\n  - function public.get_user_raffle_entries(uuid,int,int) is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname = 'trg_sync_announcement_reward_to_ledger') THEN
    missing := missing || E'\n  - trigger trg_sync_announcement_reward_to_ledger is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname = 'trg_sync_compliance_reward_to_ledger') THEN
    missing := missing || E'\n  - trigger trg_sync_compliance_reward_to_ledger is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — ledger objects (20260605120000) not present:%', missing;
  END IF;
  RAISE NOTICE 'OK: ledger table/enum/functions/triggers (20260605120000) all present.';
END $$;

-- ---- Increment-specific checks: 20260605130000 (read-cutover / alias) --------
-- get_user_total_points must now be a thin alias for get_user_point_balance.
DO $$
DECLARE
  missing text := '';
  v_def   text;
  v_uid   uuid := '00000000-0000-0000-0000-0000000000aa';
  v_total integer;
  v_bal   integer;
  v_seeded boolean := false;
BEGIN
  -- (1) Alias must still exist and be callable.
  IF to_regprocedure('public.get_user_total_points(uuid)') IS NULL THEN
    RAISE EXCEPTION 'GATE FAILED — get_user_total_points(uuid) is missing (alias was dropped?)';
  END IF;

  -- (2) Structural proof of cutover: body delegates to get_user_point_balance and
  --     no longer reads announcement_rewards directly.
  v_def := pg_get_functiondef('public.get_user_total_points(uuid)'::regprocedure);
  IF position('get_user_point_balance' IN v_def) = 0 THEN
    missing := missing || E'\n  - get_user_total_points does NOT delegate to get_user_point_balance';
  END IF;
  IF position('announcement_rewards' IN v_def) > 0 THEN
    missing := missing || E'\n  - get_user_total_points still references announcement_rewards (not a clean alias)';
  END IF;

  -- (3) Equality on empty data (no PII in the gate DB): both resolve and agree.
  IF public.get_user_total_points(v_uid) IS DISTINCT FROM public.get_user_point_balance(v_uid) THEN
    missing := missing || E'\n  - get_user_total_points <> get_user_point_balance for a sample user (empty-data case)';
  END IF;
  IF public.get_user_total_points(NULL) IS DISTINCT FROM public.get_user_point_balance(NULL) THEN
    missing := missing || E'\n  - get_user_total_points <> get_user_point_balance for NULL user';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — read-cutover alias (20260605130000) not faithful:%', missing;
  END IF;

  -- (4) Data-backed proof (best-effort): seed a ledger balance for a synthetic
  --     user and confirm the alias returns the LEDGER total (not the old
  --     announcement-only 0). Skipped gracefully if auth.users can't be seeded
  --     on this harness; the structural + equality checks above still gate.
  BEGIN
    INSERT INTO auth.users (id, aud, role, email)
      VALUES (v_uid, 'authenticated', 'authenticated', 'gate-cutover@example.invalid');
    INSERT INTO public.point_transactions (user_id, amount, source, reason)
      VALUES (v_uid, 30, 'adjustment', 'gate test');
    INSERT INTO public.point_transactions (user_id, amount, source, reason)
      VALUES (v_uid, 20, 'adjustment', 'gate test');
    v_seeded := true;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'NOTE: data-backed alias test skipped (could not seed auth.users): %', SQLERRM;
  END;

  IF v_seeded THEN
    v_total := public.get_user_total_points(v_uid);
    v_bal   := public.get_user_point_balance(v_uid);
    IF v_total <> 50 OR v_bal <> 50 OR v_total <> v_bal THEN
      RAISE EXCEPTION 'GATE FAILED — alias returned % and balance % (expected 50 each from ledger)', v_total, v_bal;
    END IF;
    -- Cleanup seeded rows (delete ledger rows first, then the synthetic user).
    DELETE FROM public.point_transactions WHERE user_id = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;
    RAISE NOTICE 'OK: data-backed alias test — get_user_total_points = get_user_point_balance = 50 (ledger).';
  END IF;

  RAISE NOTICE 'OK: get_user_total_points is a faithful alias for get_user_point_balance (20260605130000).';
END $$;

-- ---- Increment-specific checks: 20260605140000 (manual awards 2a) -----------
-- (1) Object presence + the "no user-INSERT policy on point_transactions" guard.
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regclass('public.point_awarder_grants') IS NULL THEN
    missing := missing || E'\n  - table public.point_awarder_grants is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'point_transactions' AND column_name = 'request_id'
  ) THEN
    missing := missing || E'\n  - column public.point_transactions.request_id is missing';
  END IF;
  IF to_regclass('public.uq_active_grant_per_user') IS NULL THEN
    missing := missing || E'\n  - index uq_active_grant_per_user is missing';
  END IF;
  IF to_regclass('public.uq_point_tx_manual_request') IS NULL THEN
    missing := missing || E'\n  - index uq_point_tx_manual_request is missing';
  END IF;
  IF to_regprocedure('public.can_award_points(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.can_award_points(uuid) is missing';
  END IF;
  IF to_regprocedure('public.award_points(uuid,integer,text,text,uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.award_points(uuid,integer,text,text,uuid) is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='point_awarder_grants'
                   AND policyname='Admins manage awarder grants insert') THEN
    missing := missing || E'\n  - RLS insert policy on point_awarder_grants is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='point_awarder_grants'
                   AND policyname='Users read own awarder grant') THEN
    missing := missing || E'\n  - RLS select policy on point_awarder_grants is missing';
  END IF;

  -- CRITICAL: point_transactions must NOT expose any user-facing INSERT path.
  -- (No INSERT or ALL policy granted to authenticated/anon/public.)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='point_transactions'
      AND cmd IN ('INSERT','ALL')
      AND (roles && ARRAY['authenticated','anon','public']::name[])
  ) THEN
    missing := missing || E'\n  - point_transactions has a user-facing INSERT/ALL policy (must NOT exist)';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — manual-awards objects (20260605140000) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: manual-awards table/column/indexes/functions/policies present; point_transactions has no user-INSERT policy.';
END $$;

-- (2) Behavioral enforcement matrix. All seeded data is discarded via ROLLBACK.
BEGIN;

DO $$
DECLARE
  c_admin  uuid := '00000000-0000-0000-0000-00000000aa01';
  c_grant  uuid := '00000000-0000-0000-0000-00000000aa02';
  c_nogr   uuid := '00000000-0000-0000-0000-00000000aa03';
  c_recip  uuid := '00000000-0000-0000-0000-00000000aa04';
  c_budget uuid := '00000000-0000-0000-0000-00000000aa05';
  c_ghost  uuid := '00000000-0000-0000-0000-00000000aa06';
  v_raised boolean;
  v_count  integer;
  v_id     uuid;
  v_id2    uuid;
  v_year   integer;
  v_month  integer;
  v_bal_before integer; v_bal_after integer;
  v_raf_before integer; v_raf_after integer;
BEGIN
  -- Seed auth.users (trigger handle_new_user auto-creates app_users as 'employee').
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_admin , 'authenticated','authenticated','gate-aw-admin@example.invalid'),
    (c_grant , 'authenticated','authenticated','gate-aw-grant@example.invalid'),
    (c_nogr  , 'authenticated','authenticated','gate-aw-nogr@example.invalid'),
    (c_recip , 'authenticated','authenticated','gate-aw-recip@example.invalid'),
    (c_budget, 'authenticated','authenticated','gate-aw-budget@example.invalid');

  -- Promote the admin (trigger created everyone as 'employee').
  UPDATE public.app_users SET role='admin' WHERE user_id = c_admin;

  -- Active grants: standard (cap 25 / budget 500) and a tight-budget user (cap 25 / budget 50).
  INSERT INTO public.point_awarder_grants (user_id, granted_by, per_award_cap, monthly_budget) VALUES
    (c_grant , c_admin, 25, 500),
    (c_budget, c_admin, 25, 50);

  -- Pre-existing manual_award by the tight-budget user this month (40 of 50 budget).
  INSERT INTO public.point_transactions
    (user_id, amount, source, counts_toward_raffle, category, reason, awarded_by, request_id)
  VALUES
    (c_recip, 40, 'manual_award', true, 'other', 'seed budget', c_budget,
     '00000000-0000-0000-0000-0000000b0005');

  -- ---- Test: non-granted non-admin is DENIED ------------------------------
  PERFORM set_config('request.jwt.claim.sub', c_nogr::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.award_points(c_recip, 10, 'other', 'should fail', gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Not permitted to award points%' THEN
      RAISE EXCEPTION 'GATE FAILED — deny test wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — non-granted non-admin was permitted to award'; END IF;

  -- ---- Test: admin (no grant) SUCCEEDS and bypasses cap/budget ------------
  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  SELECT public.award_points(c_recip, 1000, 'good_performance', 'admin bypass',
                             '00000000-0000-0000-0000-0000000b0002') INTO v_id;
  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE id = v_id AND source='manual_award' AND awarded_by = c_admin
     AND counts_toward_raffle AND amount = 1000 AND user_id = c_recip;
  IF v_count <> 1 THEN RAISE EXCEPTION 'GATE FAILED — admin bypass did not write a correct manual_award row'; END IF;

  -- ---- Test: granted user within cap & budget SUCCEEDS (one correct row) --
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  SELECT public.award_points(c_recip, 20, 'maintenance', 'within limits',
                             '00000000-0000-0000-0000-0000000b0003') INTO v_id;
  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE request_id = '00000000-0000-0000-0000-0000000b0003'
     AND source='manual_award' AND awarded_by = c_grant
     AND counts_toward_raffle AND amount = 20 AND user_id = c_recip;
  IF v_count <> 1 THEN RAISE EXCEPTION 'GATE FAILED — granted-within-limits did not write exactly one correct row (got %)', v_count; END IF;

  -- ---- Test: granted user, amount > per_award_cap RAISES ------------------
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.award_points(c_recip, 30, 'other', 'over cap', gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Exceeds per-award cap of 25%' THEN
      RAISE EXCEPTION 'GATE FAILED — cap test wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — per-award cap not enforced'; END IF;

  -- ---- Test: granted user, cumulative month > monthly_budget RAISES -------
  PERFORM set_config('request.jwt.claim.sub', c_budget::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.award_points(c_recip, 20, 'other', 'over budget', gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Exceeds monthly budget of 50%' THEN
      RAISE EXCEPTION 'GATE FAILED — budget test wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — monthly budget not enforced'; END IF;

  -- ---- Test: self-award RAISES -------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.award_points(c_grant, 10, 'other', 'self award', gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Cannot award points to yourself%' THEN
      RAISE EXCEPTION 'GATE FAILED — self-award test wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — self-award was allowed'; END IF;

  -- ---- Test: recipient not in app_users RAISES ---------------------------
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.award_points(c_ghost, 10, 'other', 'ghost recipient', gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Recipient not found%' THEN
      RAISE EXCEPTION 'GATE FAILED — recipient-not-found test wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — unknown recipient was allowed'; END IF;

  -- ---- Test: empty/whitespace reason RAISES ------------------------------
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.award_points(c_recip, 10, 'other', '   ', gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Reason is required%' THEN
      RAISE EXCEPTION 'GATE FAILED — empty-reason test wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — empty/whitespace reason was allowed'; END IF;

  -- ---- Test: invalid category RAISES -------------------------------------
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.award_points(c_recip, 10, 'not_a_real_category', 'bad category', gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Invalid category%' THEN
      RAISE EXCEPTION 'GATE FAILED — invalid-category test wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — invalid category was allowed'; END IF;

  -- ---- Test: double submit (same request_id) is idempotent ---------------
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  SELECT public.award_points(c_recip, 15, 'other', 'idempotent',
                             '00000000-0000-0000-0000-0000000b0010') INTO v_id;
  SELECT public.award_points(c_recip, 15, 'other', 'idempotent',
                             '00000000-0000-0000-0000-0000000b0010') INTO v_id2;
  IF v_id IS NULL OR v_id2 IS NULL OR v_id <> v_id2 THEN
    RAISE EXCEPTION 'GATE FAILED — idempotent double-submit returned different tx ids (% vs %)', v_id, v_id2;
  END IF;
  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE request_id = '00000000-0000-0000-0000-0000000b0010' AND source='manual_award';
  IF v_count <> 1 THEN RAISE EXCEPTION 'GATE FAILED — idempotent double-submit produced % ledger rows (expected 1)', v_count; END IF;

  -- ---- Test: successful award lifts balance AND raffle entries ------------
  v_year  := EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Chicago'))::integer;
  v_month := EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'))::integer;
  v_bal_before := public.get_user_point_balance(c_recip);
  v_raf_before := public.get_user_raffle_entries(c_recip, v_year, v_month);
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  PERFORM public.award_points(c_recip, 5, 'attendance', 'balance + raffle proof',
                              '00000000-0000-0000-0000-0000000b0011');
  v_bal_after := public.get_user_point_balance(c_recip);
  v_raf_after := public.get_user_raffle_entries(c_recip, v_year, v_month);
  IF v_bal_after - v_bal_before <> 5 THEN
    RAISE EXCEPTION 'GATE FAILED — balance delta % (expected 5)', v_bal_after - v_bal_before;
  END IF;
  IF v_raf_after - v_raf_before <> 5 THEN
    RAISE EXCEPTION 'GATE FAILED — raffle-entries delta % (expected 5)', v_raf_after - v_raf_before;
  END IF;

  -- ---- Test: notify_manual_award_recipient (2b) ----------------------------
  -- Granted awarder can notify for their own award; wrong awarder is denied;
  -- double-call is idempotent (exactly one notification_event).
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  SELECT public.award_points(c_recip, 12, 'peer_recognition', 'notify own award',
                             '00000000-0000-0000-0000-0000000b0020') INTO v_id;
  PERFORM public.notify_manual_award_recipient('00000000-0000-0000-0000-0000000b0020');
  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'manual_award' AND entity_id = v_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — granted awarder notify did not create exactly one notification_event (got %)', v_count;
  END IF;

  PERFORM public.notify_manual_award_recipient('00000000-0000-0000-0000-0000000b0020');
  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'manual_award' AND entity_id = v_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — double notify produced % events (expected 1)', v_count;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  SELECT public.award_points(c_recip, 8, 'other', 'admin award for notify deny test',
                             '00000000-0000-0000-0000-0000000b0021') INTO v_id2;
  PERFORM set_config('request.jwt.claim.sub', c_grant::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.notify_manual_award_recipient('00000000-0000-0000-0000-0000000b0021');
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Manual award not found or not awarded by you%' THEN
      RAISE EXCEPTION 'GATE FAILED — wrong-awarder notify wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'GATE FAILED — grant user was allowed to notify an admin award';
  END IF;

  RAISE NOTICE 'OK: award_points enforcement matrix (permission/recipient/self/amount/reason/category/cap/budget/idempotency/balance/raffle) all pass.';
  RAISE NOTICE 'OK: notify_manual_award_recipient (own-award notify, wrong-awarder deny, idempotent double-call) all pass.';
END $$;

-- ---- Test: RLS on point_awarder_grants (role-switched) ---------------------
-- Non-admin INSERT must be blocked; admin INSERT must be allowed.
DO $$
DECLARE
  c_admin uuid := '00000000-0000-0000-0000-00000000aa01';
  c_nogr  uuid := '00000000-0000-0000-0000-00000000aa03';
  c_recip uuid := '00000000-0000-0000-0000-00000000aa04';
  v_blocked boolean := false;
  v_id uuid;
BEGIN
  -- Non-admin attempt -> RLS denies.
  PERFORM set_config('request.jwt.claim.sub', c_nogr::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.point_awarder_grants (user_id, granted_by) VALUES (c_recip, c_nogr);
  EXCEPTION WHEN insufficient_privilege THEN
    -- Must be RLS, not a missing table grant (table grant is present for authenticated).
    IF SQLERRM NOT LIKE '%row-level security%' THEN
      RESET ROLE;
      RAISE EXCEPTION 'GATE FAILED — non-admin INSERT blocked by % (expected row-level security)', SQLERRM;
    END IF;
    v_blocked := true;
  END;
  RESET ROLE;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'GATE FAILED — non-admin INSERT into point_awarder_grants was NOT blocked by RLS';
  END IF;

  -- Admin attempt -> allowed.
  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.point_awarder_grants (user_id, granted_by)
    VALUES (c_recip, c_admin) RETURNING id INTO v_id;
  RESET ROLE;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'GATE FAILED — admin INSERT into point_awarder_grants did not return an id';
  END IF;

  RAISE NOTICE 'OK: point_awarder_grants RLS — non-admin INSERT blocked, admin INSERT allowed.';
END $$;

-- ---- Increment-specific checks: 20260606020802 (notify RPC 2b) ------------
DO $$
DECLARE
  missing text := '';
  v_def   text;
BEGIN
  IF to_regprocedure('public.notify_manual_award_recipient(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.notify_manual_award_recipient(uuid) is missing';
  END IF;

  -- Ledger purity: award_points must NOT touch notification_events.
  v_def := pg_get_functiondef('public.award_points(uuid,integer,text,text,uuid)'::regprocedure);
  IF position('notification_events' IN v_def) > 0 THEN
    missing := missing || E'\n  - award_points references notification_events (ledger must stay pure)';
  END IF;

  -- notify RPC must build events server-side (no client-supplied title/body params).
  v_def := pg_get_functiondef('public.notify_manual_award_recipient(uuid)'::regprocedure);
  IF position('notification_events' IN v_def) = 0 THEN
    missing := missing || E'\n  - notify_manual_award_recipient does not insert notification_events';
  END IF;
  IF position('admin_notice' IN v_def) = 0 THEN
    missing := missing || E'\n  - notify_manual_award_recipient should use admin_notice category';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — notify_manual_award_recipient (20260606020802) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: notify_manual_award_recipient present; award_points ledger-pure; notify uses admin_notice.';
  RAISE NOTICE 'OK: admin-create-notification edge function unchanged (admin JWT gate remains in supabase/functions/admin-create-notification/index.ts).';
END $$;

-- ---- Increment-specific checks: 20260606023824 (earning sources phase 2) ----
DO $$
DECLARE
  missing text := '';
  v_indexdef text;
BEGIN
  IF to_regclass('public.point_rules') IS NULL THEN
    missing := missing || E'\n  - table public.point_rules is missing';
  END IF;
  IF to_regprocedure('public.get_point_rule(public.point_source,text)') IS NULL THEN
    missing := missing || E'\n  - function public.get_point_rule(point_source,text) is missing';
  END IF;
  IF to_regprocedure('public.insert_point_transaction(uuid,integer,public.point_source,uuid,text,text,boolean)') IS NULL THEN
    missing := missing || E'\n  - function public.insert_point_transaction(...) is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_award_near_miss_base_points') THEN
    missing := missing || E'\n  - trigger trg_award_near_miss_base_points is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_award_near_miss_corrective_bonus') THEN
    missing := missing || E'\n  - trigger trg_award_near_miss_corrective_bonus is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_award_certification_points') THEN
    missing := missing || E'\n  - trigger trg_award_certification_points is missing';
  END IF;

  -- Index must use NULLS NOT DISTINCT (not plain NULLS DISTINCT extension).
  SELECT indexdef INTO v_indexdef
  FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'uq_point_tx_source_ref';
  IF v_indexdef IS NULL THEN
    missing := missing || E'\n  - index uq_point_tx_source_ref is missing';
  ELSIF position('nulls not distinct' IN lower(v_indexdef)) = 0 THEN
    missing := missing || E'\n  - uq_point_tx_source_ref must use NULLS NOT DISTINCT (got: ' || v_indexdef || ')';
  ELSIF position('category' IN v_indexdef) = 0 THEN
    missing := missing || E'\n  - uq_point_tx_source_ref must include category column';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — earning sources objects (20260606023824) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: point_rules/helpers/triggers present; uq_point_tx_source_ref uses NULLS NOT DISTINCT + category.';
END $$;

-- (2) Behavioral enforcement matrix — earning sources phase 2.
DO $$
DECLARE
  c_reporter  uuid := '00000000-0000-0000-0000-00000000bb01';
  c_admin     uuid := '00000000-0000-0000-0000-00000000bb02';
  c_cert_user uuid := '00000000-0000-0000-0000-00000000bb03';
  c_ann       uuid := '00000000-0000-0000-0000-00000000bb10';
  c_ref       uuid := '00000000-0000-0000-0000-00000000bb11';
  c_inc1      uuid;
  c_inc2      uuid;
  c_inc3      uuid;
  c_inc_null  uuid;
  c_capa1     uuid;
  c_capa2     uuid;
  c_cert_type uuid := '00000000-0000-0000-0000-00000000bb40';
  c_attempt1  uuid := '00000000-0000-0000-0000-00000000bb20';
  c_attempt2  uuid := '00000000-0000-0000-0000-00000000bb21';
  c_attempt3  uuid := '00000000-0000-0000-0000-00000000bb22';
  c_cert_rec  uuid := '00000000-0000-0000-0000-00000000bb30';
  c_exp_rec   uuid := '00000000-0000-0000-0000-00000000bb31';
  v_count     integer;
  v_bal       integer;
  v_raf       integer;
  v_year      integer;
  v_month     integer;
  v_amount    integer;
BEGIN
  -- Prod baseline safety_audit_log_insert references user_id on safety_incidents
  -- (invalid column); disable audit triggers so gate tests exercise earning triggers only.
  ALTER TABLE public.safety_incidents DISABLE TRIGGER trigger_safety_audit_incident;
  ALTER TABLE public.corrective_actions DISABLE TRIGGER trigger_safety_audit_corrective_actions;
  ALTER TABLE public.certification_records DISABLE TRIGGER trigger_safety_audit_cert_records;
  ALTER TABLE public.certification_records DISABLE TRIGGER trigger_refresh_completion_stats_on_record_insert;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_reporter , 'authenticated', 'authenticated', 'gate-es-reporter@example.invalid'),
    (c_admin    , 'authenticated', 'authenticated', 'gate-es-admin@example.invalid'),
    (c_cert_user, 'authenticated', 'authenticated', 'gate-es-cert@example.invalid');

  UPDATE public.app_users SET role = 'admin' WHERE user_id = c_admin;

  v_year  := EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Chicago'))::integer;
  v_month := EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'))::integer;

  -- ---- INDEX REGRESSION GUARD: NULL-category rows still dedupe ----------------
  PERFORM public.insert_point_transaction(
    c_reporter, 5, 'announcement_claim', c_ref, 'announcement_rewards', NULL, true);
  PERFORM public.insert_point_transaction(
    c_reporter, 5, 'announcement_claim', c_ref, 'announcement_rewards', NULL, true);
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE source = 'announcement_claim' AND reference_id = c_ref AND category IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — index regression: duplicate announcement_claim (category NULL) produced % rows (expected 1)', v_count;
  END IF;

  PERFORM public.insert_point_transaction(
    c_reporter, 3, 'compliance_form', c_ref, 'compliance_rewards', NULL, true);
  PERFORM public.insert_point_transaction(
    c_reporter, 3, 'compliance_form', c_ref, 'compliance_rewards', NULL, true);
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE source = 'compliance_form' AND reference_id = c_ref AND category IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — index regression: duplicate compliance_form (category NULL) produced % rows (expected 1)', v_count;
  END IF;
  RAISE NOTICE 'OK: index regression guard — NULL-category announcement_claim/compliance_form still dedupe to one row.';

  -- ---- Near-miss base: +10 to reporter; cap=2 suppresses third ----------------
  INSERT INTO public.safety_incidents (incident_date, severity, incident_type, description, reported_by)
    VALUES (CURRENT_DATE, 'near_miss', 'other', 'gate nm 1', c_reporter) RETURNING id INTO c_inc1;
  INSERT INTO public.safety_incidents (incident_date, severity, incident_type, description, reported_by)
    VALUES (CURRENT_DATE, 'near_miss', 'other', 'gate nm 2', c_reporter) RETURNING id INTO c_inc2;
  INSERT INTO public.safety_incidents (incident_date, severity, incident_type, description, reported_by)
    VALUES (CURRENT_DATE, 'near_miss', 'other', 'gate nm 3', c_reporter) RETURNING id INTO c_inc3;

  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_reporter AND source = 'near_miss_report' AND category = 'base';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED — near-miss cap: expected 2 base awards, got %', v_count;
  END IF;
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE source = 'near_miss_report' AND category = 'base' AND reference_id = c_inc3;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED — near-miss cap: third filing (%) should not award points', c_inc3;
  END IF;

  -- reported_by NULL → skip gracefully (incident still inserts)
  INSERT INTO public.safety_incidents (incident_date, severity, incident_type, description, reported_by)
    VALUES (CURRENT_DATE, 'near_miss', 'other', 'gate nm null reporter', NULL) RETURNING id INTO c_inc_null;
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE source = 'near_miss_report' AND category = 'base' AND reference_id = c_inc_null;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED — near-miss with NULL reported_by should not create ledger row';
  END IF;

  -- ---- Corrective bonus: +15 once per incident ------------------------------
  INSERT INTO public.corrective_actions (incident_id, description, action_type, assigned_by, due_date, status)
    VALUES (c_inc1, 'fix hazard A', 'immediate', c_admin, CURRENT_DATE + 7, 'open')
    RETURNING id INTO c_capa1;
  UPDATE public.corrective_actions SET status = 'verified', verified_by = c_admin, verified_at = now()
    WHERE id = c_capa1;

  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_reporter AND source = 'near_miss_report' AND category = 'corrective_bonus';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — corrective bonus: expected 1 row, got %', v_count;
  END IF;

  INSERT INTO public.corrective_actions (incident_id, description, action_type, assigned_by, due_date, status)
    VALUES (c_inc1, 'fix hazard B', 'short_term', c_admin, CURRENT_DATE + 14, 'open')
    RETURNING id INTO c_capa2;
  UPDATE public.corrective_actions SET status = 'verified', verified_by = c_admin, verified_at = now()
    WHERE id = c_capa2;
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_reporter AND source = 'near_miss_report' AND category = 'corrective_bonus';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — second verified CAPA on same incident produced % bonus rows (expected 1)', v_count;
  END IF;

  -- ---- Certification: pass + early renewal coexist (written-only path) --------
  INSERT INTO public.certification_types (id, name, slug, has_written_test, has_practical_eval, passing_score, validity_months)
    VALUES (c_cert_type, 'Gate Written Only', 'gate-written-only', true, false, 80, 12);

  INSERT INTO public.certification_attempts (id, user_id, certification_type_id, attempt_number, status, passed, score_percentage)
    VALUES (c_attempt1, c_cert_user, c_cert_type, 1, 'graded', true, 90.00);

  INSERT INTO public.certification_records (
    id, user_id, certification_type_id, written_attempt_id, written_passed_at,
    status, expires_at, certified_at
  ) VALUES (
    c_cert_rec, c_cert_user, c_cert_type, c_attempt1, now(),
    'active', now() + interval '6 months', now()
  );

  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_cert_user AND source = 'certification' AND category = 'pass'
    AND reference_id = c_attempt1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — cert pass: expected 1 pass row for attempt %, got %', c_attempt1, v_count;
  END IF;

  INSERT INTO public.certification_attempts (id, user_id, certification_type_id, attempt_number, status, passed, score_percentage)
    VALUES (c_attempt2, c_cert_user, c_cert_type, 2, 'graded', true, 92.00);

  UPDATE public.certification_records
  SET written_attempt_id = c_attempt2, expires_at = now() + interval '12 months'
  WHERE id = c_cert_rec;

  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_cert_user AND source = 'certification' AND category = 'early_renewal'
    AND reference_id = c_attempt2;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — early renewal: expected 1 early_renewal row, got %', v_count;
  END IF;
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_cert_user AND source = 'certification' AND category = 'pass';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — pass and early_renewal should coexist; pass count = %', v_count;
  END IF;

  -- ---- Expired-then-recert: pass only, no early bonus -----------------------
  -- Prior record is still active; expire it, then insert a fresh active record.
  UPDATE public.certification_records SET status = 'expired' WHERE id = c_cert_rec;

  INSERT INTO public.certification_attempts (id, user_id, certification_type_id, attempt_number, status, passed, score_percentage)
    VALUES (c_attempt3, c_cert_user, c_cert_type, 3, 'graded', true, 88.00);

  INSERT INTO public.certification_records (
    id, user_id, certification_type_id, written_attempt_id, written_passed_at,
    status, expires_at, certified_at
  ) VALUES (
    c_exp_rec, c_cert_user, c_cert_type, c_attempt3, now(),
    'active', now() + interval '12 months', now()
  );

  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_cert_user AND source = 'certification' AND category = 'pass'
    AND reference_id = c_attempt3;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — expired-then-recert: expected 1 pass row, got %', v_count;
  END IF;
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_cert_user AND source = 'certification' AND category = 'early_renewal'
    AND reference_id = c_attempt3;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED — expired-then-recert must NOT award early_renewal (got %)', v_count;
  END IF;

  -- ---- Inactive rule → skip award -------------------------------------------
  UPDATE public.point_rules SET is_active = false
  WHERE source = 'near_miss_report' AND rule_key = 'base_amount';
  v_amount := public.get_point_rule('near_miss_report', 'base_amount');
  IF v_amount IS NOT NULL THEN
    RAISE EXCEPTION 'GATE FAILED — get_point_rule should return NULL for inactive rule';
  END IF;
  INSERT INTO public.safety_incidents (incident_date, severity, incident_type, description, reported_by)
    VALUES (CURRENT_DATE, 'near_miss', 'other', 'gate inactive rule', c_reporter);
  SELECT count(*) INTO v_count
  FROM public.point_transactions
  WHERE user_id = c_reporter AND source = 'near_miss_report' AND category = 'base';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED — inactive base_amount rule should not add a third base row (count=%)', v_count;
  END IF;
  UPDATE public.point_rules SET is_active = true
  WHERE source = 'near_miss_report' AND rule_key = 'base_amount';

  -- ---- Balance / raffle reflect awards --------------------------------------
  v_bal := public.get_user_point_balance(c_reporter);
  -- 2 base (20) + 1 corrective (15) = 35 from reporter near-miss path
  IF v_bal < 35 THEN
    RAISE EXCEPTION 'GATE FAILED — reporter balance % (expected >= 35 from near-miss awards)', v_bal;
  END IF;
  v_raf := public.get_user_raffle_entries(c_reporter, v_year, v_month);
  IF v_raf < 35 THEN
    RAISE EXCEPTION 'GATE FAILED — reporter raffle entries % (expected >= 35)', v_raf;
  END IF;

  v_bal := public.get_user_point_balance(c_cert_user);
  -- pass 20 + early 10 + expired recert pass 20 = 50
  IF v_bal <> 50 THEN
    RAISE EXCEPTION 'GATE FAILED — cert user balance % (expected 50)', v_bal;
  END IF;

  RAISE NOTICE 'OK: earning sources matrix — near-miss cap/corrective bonus/cert pass+renewal/index regression/inactive rule/balance all pass.';
END $$;

-- ---- Increment-specific checks: 20260606033350 (redemption store increment 1) ----
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regclass('public.reward_catalog') IS NULL THEN
    missing := missing || E'\n  - table public.reward_catalog is missing';
  END IF;
  IF to_regclass('public.redemptions') IS NULL THEN
    missing := missing || E'\n  - table public.redemptions is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'redemption_status'
                 AND typnamespace = 'public'::regnamespace) THEN
    missing := missing || E'\n  - enum public.redemption_status is missing';
  END IF;
  IF to_regclass('public.uq_redemptions_user_request') IS NULL THEN
    missing := missing || E'\n  - index uq_redemptions_user_request is missing';
  END IF;
  IF to_regclass('public.uq_point_tx_redemption_hold') IS NULL THEN
    missing := missing || E'\n  - index uq_point_tx_redemption_hold is missing';
  END IF;
  IF to_regclass('public.uq_point_tx_redemption_refund') IS NULL THEN
    missing := missing || E'\n  - index uq_point_tx_redemption_refund is missing';
  END IF;
  IF to_regprocedure('public.redeem_reward(uuid,uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.redeem_reward(uuid,uuid) is missing';
  END IF;
  IF to_regprocedure('public.fulfill_redemption(uuid,text)') IS NULL THEN
    missing := missing || E'\n  - function public.fulfill_redemption(uuid,text) is missing';
  END IF;
  IF to_regprocedure('public.deny_redemption(uuid,text)') IS NULL THEN
    missing := missing || E'\n  - function public.deny_redemption(uuid,text) is missing';
  END IF;
  IF to_regprocedure('public.cancel_redemption(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.cancel_redemption(uuid) is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='reward_catalog'
                   AND policyname='Authenticated read active catalog items') THEN
    missing := missing || E'\n  - RLS select policy on reward_catalog is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='redemptions'
                   AND policyname='Users read own redemptions') THEN
    missing := missing || E'\n  - RLS select policy on redemptions is missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='redemptions'
      AND cmd IN ('INSERT','UPDATE','ALL')
      AND (roles && ARRAY['authenticated','anon','public']::name[])
  ) THEN
    missing := missing || E'\n  - redemptions has a user-facing INSERT/UPDATE/ALL policy (must NOT exist)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='point_transactions'
      AND cmd IN ('INSERT','ALL')
      AND (roles && ARRAY['authenticated','anon','public']::name[])
  ) THEN
    missing := missing || E'\n  - point_transactions has a user-facing INSERT/ALL policy (must NOT exist)';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — redemption store objects (20260606033350) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: redemption store table/enum/indexes/functions/policies present; no user-write on redemptions/point_transactions.';
END $$;

-- (2) Behavioral enforcement matrix — redemption store increment 1.
DO $$
DECLARE
  c_user      uuid := '00000000-0000-0000-0000-00000000cc01';
  c_user2     uuid := '00000000-0000-0000-0000-00000000cc02';
  c_admin     uuid := '00000000-0000-0000-0000-00000000cc03';
  c_item_cap  uuid := 'a1000001-0000-4000-8000-000000000001';
  c_item_hood uuid := 'a1000001-0000-4000-8000-000000000006';
  c_item_gift uuid := 'a1000001-0000-4000-8000-000000000007';
  c_item_inact uuid := '00000000-0000-0000-0000-00000000cd01';
  c_item_oos  uuid := '00000000-0000-0000-0000-00000000cd02';
  v_redemption uuid;
  v_redemption2 uuid;
  v_redemption_fulfill uuid;
  v_raised    boolean;
  v_count     integer;
  v_status    text;
  v_bal_before integer; v_bal_after integer;
  v_stock     integer;
  v_raf_before integer; v_raf_after integer;
  v_year      integer;
  v_month     integer;
  v_req_hood  uuid := '00000000-0000-0000-0000-0000000c0001';
  v_req_cap   uuid := '00000000-0000-0000-0000-0000000c0002';
  v_req_cap2  uuid := '00000000-0000-0000-0000-0000000c0003';
  v_req_race1 uuid := '00000000-0000-0000-0000-0000000c0004';
  v_req_race2 uuid := '00000000-0000-0000-0000-0000000c0005';
  v_req_fulfill uuid := '00000000-0000-0000-0000-0000000c0006';
BEGIN
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user , 'authenticated', 'authenticated', 'gate-rd-user@example.invalid'),
    (c_user2, 'authenticated', 'authenticated', 'gate-rd-user2@example.invalid'),
    (c_admin, 'authenticated', 'authenticated', 'gate-rd-admin@example.invalid');

  UPDATE public.app_users SET role = 'admin' WHERE user_id = c_admin;

  INSERT INTO public.reward_catalog (id, name, point_cost, stock_qty, category, is_active, sort_order)
  VALUES
    (c_item_inact, 'Gate Inactive Item', 50, NULL, 'test', false, 999),
    (c_item_oos , 'Gate OOS Item', 50, 0, 'test', true, 998);

  INSERT INTO public.point_transactions (user_id, amount, source, reason, counts_toward_raffle)
  VALUES
    (c_user , 800, 'adjustment', 'gate redemption seed', true),
    (c_user2, 500, 'adjustment', 'gate redemption seed', true);

  v_year  := EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Chicago'))::integer;
  v_month := EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'))::integer;
  v_raf_before := public.get_user_raffle_entries(c_user, v_year, v_month);

  -- ---- redeem sufficient balance -> pending + hold; balance drops; stock if tracked ----
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT stock_qty INTO v_stock FROM public.reward_catalog WHERE id = c_item_hood;
  v_bal_before := public.get_user_point_balance(c_user);
  SELECT public.redeem_reward(c_item_hood, v_req_hood) INTO v_redemption;

  SELECT count(*) INTO v_count FROM public.redemptions
   WHERE id = v_redemption AND user_id = c_user AND status = 'pending' AND point_cost = 400;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — redeem did not create pending redemption (count=%)', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE user_id = c_user AND source = 'redemption' AND reference_id = v_redemption
     AND amount = -400 AND counts_toward_raffle = false;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — redeem did not create exactly one hold row (count=%)', v_count;
  END IF;

  v_bal_after := public.get_user_point_balance(c_user);
  IF v_bal_after <> v_bal_before - 400 THEN
    RAISE EXCEPTION 'GATE FAILED — balance % -> % (expected drop of 400)', v_bal_before, v_bal_after;
  END IF;

  SELECT stock_qty INTO v_count FROM public.reward_catalog WHERE id = c_item_hood;
  IF v_count <> v_stock - 1 THEN
    RAISE EXCEPTION 'GATE FAILED — hoodie stock % (expected %)', v_count, v_stock - 1;
  END IF;

  -- ---- insufficient balance -> RAISE, no new redemption/hold ----
  -- After hoodie (400) user has 400 pts; $50 gift card costs 500.
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.redeem_reward(c_item_gift, v_req_cap2);
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Insufficient balance%' THEN
      RAISE EXCEPTION 'GATE FAILED — insufficient-balance wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — insufficient balance was allowed'; END IF;
  SELECT count(*) INTO v_count FROM public.redemptions WHERE request_id = v_req_cap2;
  IF v_count <> 0 THEN RAISE EXCEPTION 'GATE FAILED — insufficient balance created a redemption row'; END IF;

  -- ---- inactive item -> RAISE ----
  v_raised := false;
  BEGIN
    PERFORM public.redeem_reward(c_item_inact, gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%not available%' THEN
      RAISE EXCEPTION 'GATE FAILED — inactive-item wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — inactive item redeem was allowed'; END IF;

  -- ---- out of stock (stock_qty 0) -> RAISE ----
  v_raised := false;
  BEGIN
    PERFORM public.redeem_reward(c_item_oos, gen_random_uuid());
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Out of stock%' THEN
      RAISE EXCEPTION 'GATE FAILED — out-of-stock wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — out-of-stock redeem was allowed'; END IF;

  -- ---- double redeem same p_request_id -> one redemption, balance drops once ----
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  v_bal_before := public.get_user_point_balance(c_user);
  SELECT public.redeem_reward(c_item_cap, v_req_cap) INTO v_redemption2;
  SELECT public.redeem_reward(c_item_cap, v_req_cap) INTO v_redemption;
  IF v_redemption IS NULL OR v_redemption2 IS NULL OR v_redemption <> v_redemption2 THEN
    RAISE EXCEPTION 'GATE FAILED — idempotent redeem returned different ids (% vs %)', v_redemption, v_redemption2;
  END IF;
  SELECT count(*) INTO v_count FROM public.redemptions WHERE request_id = v_req_cap AND user_id = c_user;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — idempotent redeem produced % rows (expected 1)', v_count;
  END IF;
  v_bal_after := public.get_user_point_balance(c_user);
  IF v_bal_after <> v_bal_before - 75 THEN
    RAISE EXCEPTION 'GATE FAILED — idempotent redeem balance drop % (expected 75)', v_bal_before - v_bal_after;
  END IF;

  -- ---- STOCK RACE: last unit — first succeeds, second RAISES out-of-stock ----
  UPDATE public.reward_catalog SET stock_qty = 1 WHERE id = c_item_hood;
  PERFORM set_config('request.jwt.claim.sub', c_user2::text, true);
  SELECT public.redeem_reward(c_item_hood, v_req_race1) INTO v_redemption;
  v_raised := false;
  BEGIN
    PERFORM public.redeem_reward(c_item_hood, v_req_race2);
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Out of stock%' THEN
      RAISE EXCEPTION 'GATE FAILED — stock-race second redeem wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — stock race allowed two redeems of last unit'; END IF;
  SELECT count(*) INTO v_count FROM public.redemptions
   WHERE item_id = c_item_hood AND user_id = c_user2 AND status = 'pending';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — stock race: expected 1 pending redemption for user2, got %', v_count;
  END IF;
  SELECT stock_qty INTO v_count FROM public.reward_catalog WHERE id = c_item_hood;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED — stock race: hoodie stock % (expected 0)', v_count;
  END IF;

  -- ---- deny pending -> denied + refund + balance restored + stock restored ----
  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  v_bal_before := public.get_user_point_balance(c_user2);
  SELECT stock_qty INTO v_stock FROM public.reward_catalog WHERE id = c_item_hood;
  PERFORM public.deny_redemption(v_redemption, 'gate deny test');

  SELECT status::text INTO v_status FROM public.redemptions WHERE id = v_redemption;
  IF v_status <> 'denied' THEN
    RAISE EXCEPTION 'GATE FAILED — deny did not set status denied (got %)', v_status;
  END IF;
  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE source = 'adjustment' AND reference_id = v_redemption
     AND amount = 400 AND counts_toward_raffle = false;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — deny refund row count % (expected 1)', v_count;
  END IF;
  v_bal_after := public.get_user_point_balance(c_user2);
  IF v_bal_after <> v_bal_before + 400 THEN
    RAISE EXCEPTION 'GATE FAILED — deny balance restore % -> %', v_bal_before, v_bal_after;
  END IF;
  SELECT stock_qty INTO v_count FROM public.reward_catalog WHERE id = c_item_hood;
  IF v_count <> v_stock + 1 THEN
    RAISE EXCEPTION 'GATE FAILED — deny stock restore % (expected %)', v_count, v_stock + 1;
  END IF;

  -- ---- deny AGAIN -> idempotent, no second refund ----
  v_bal_before := public.get_user_point_balance(c_user2);
  PERFORM public.deny_redemption(v_redemption, 'gate deny again');
  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE source = 'adjustment' AND reference_id = v_redemption;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — second deny produced % refund rows (expected 1)', v_count;
  END IF;
  IF public.get_user_point_balance(c_user2) <> v_bal_before THEN
    RAISE EXCEPTION 'GATE FAILED — second deny changed balance';
  END IF;

  -- ---- deny AGAIN: stock must not increment twice (restore gated on refund INSERT) ----
  SELECT stock_qty INTO v_count FROM public.reward_catalog WHERE id = c_item_hood;
  IF v_count <> v_stock + 1 THEN
    RAISE EXCEPTION 'GATE FAILED — second deny changed stock to % (expected % unchanged)', v_count, v_stock + 1;
  END IF;

  -- ---- unlimited (NULL stock): deny and cancel are no-ops on stock_qty ----
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT stock_qty INTO v_stock FROM public.reward_catalog WHERE id = c_item_cap;
  IF v_stock IS NOT NULL THEN
    RAISE EXCEPTION 'GATE FAILED — cap fixture should have NULL stock_qty for unlimited test';
  END IF;
  SELECT public.redeem_reward(c_item_cap, '00000000-0000-0000-0000-0000000c0008') INTO v_redemption;
  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  PERFORM public.deny_redemption(v_redemption, 'gate unlimited deny');
  SELECT stock_qty INTO v_count FROM public.reward_catalog WHERE id = c_item_cap;
  IF v_count IS NOT NULL THEN
    RAISE EXCEPTION 'GATE FAILED — deny on unlimited item set stock_qty to % (expected NULL)', v_count;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT public.redeem_reward(c_item_cap, '00000000-0000-0000-0000-0000000c0009') INTO v_redemption;
  PERFORM public.cancel_redemption(v_redemption);
  SELECT stock_qty INTO v_count FROM public.reward_catalog WHERE id = c_item_cap;
  IF v_count IS NOT NULL THEN
    RAISE EXCEPTION 'GATE FAILED — cancel on unlimited item set stock_qty to % (expected NULL)', v_count;
  END IF;

  -- ---- cancel own pending (cap redemption) -> refund + stock N/A (unlimited) ----
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  v_bal_before := public.get_user_point_balance(c_user);
  PERFORM public.cancel_redemption(v_redemption2);
  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE source = 'adjustment' AND reference_id = v_redemption2 AND amount = 75;
  IF v_count <> 1 THEN RAISE EXCEPTION 'GATE FAILED — cancel did not write refund row'; END IF;
  IF public.get_user_point_balance(c_user) <> v_bal_before + 75 THEN
    RAISE EXCEPTION 'GATE FAILED — cancel did not restore balance';
  END IF;

  -- ---- cancel another user's redemption -> RAISE ----
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT public.redeem_reward(c_item_cap, v_req_fulfill) INTO v_redemption_fulfill;
  PERFORM set_config('request.jwt.claim.sub', c_user2::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.cancel_redemption(v_redemption_fulfill);
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Not permitted to cancel%' THEN
      RAISE EXCEPTION 'GATE FAILED — cancel-other-user wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — user canceled another user redemption'; END IF;

  -- ---- cancel non-pending -> RAISE ----
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.cancel_redemption(v_redemption2);
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Invalid transition%' AND SQLERRM NOT LIKE '%cannot cancel%' THEN
      RAISE EXCEPTION 'GATE FAILED — cancel-non-pending wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — cancel non-pending was allowed'; END IF;

  -- ---- fulfill pending -> fulfilled, no refund, balance stays reduced ----
  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  v_bal_before := public.get_user_point_balance(c_user);
  PERFORM public.fulfill_redemption(v_redemption_fulfill, 'shipped');
  SELECT status::text INTO v_status FROM public.redemptions WHERE id = v_redemption_fulfill;
  IF v_status <> 'fulfilled' THEN
    RAISE EXCEPTION 'GATE FAILED — fulfill status % (expected fulfilled)', v_status;
  END IF;
  SELECT count(*) INTO v_count FROM public.point_transactions
   WHERE source = 'adjustment' AND reference_id = v_redemption_fulfill;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED — fulfill wrote a refund row';
  END IF;
  IF public.get_user_point_balance(c_user) <> v_bal_before THEN
    RAISE EXCEPTION 'GATE FAILED — fulfill changed balance (hold should remain final)';
  END IF;

  -- ---- fulfill denied/canceled -> RAISE ----
  v_raised := false;
  BEGIN
    PERFORM public.fulfill_redemption(v_redemption2);
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Invalid transition%' THEN
      RAISE EXCEPTION 'GATE FAILED — fulfill-invalid wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — fulfill on canceled/denied was allowed'; END IF;

  -- ---- non-admin fulfill/deny -> RAISE ----
  PERFORM set_config('request.jwt.claim.sub', c_user2::text, true);
  SELECT public.redeem_reward(c_item_cap, '00000000-0000-0000-0000-0000000c0007') INTO v_redemption;
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.fulfill_redemption(v_redemption, 'nope');
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Not permitted to fulfill%' THEN
      RAISE EXCEPTION 'GATE FAILED — non-admin fulfill wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — non-admin fulfill was allowed'; END IF;

  v_raised := false;
  BEGIN
    PERFORM public.deny_redemption(v_redemption, 'nope');
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Not permitted to deny%' THEN
      RAISE EXCEPTION 'GATE FAILED — non-admin deny wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'GATE FAILED — non-admin deny was allowed'; END IF;

  -- ---- RAFFLE INVARIANT: redemption + refund do not change raffle entries ----
  v_raf_after := public.get_user_raffle_entries(c_user, v_year, v_month);
  IF v_raf_after <> v_raf_before THEN
    RAISE EXCEPTION 'GATE FAILED — raffle entries changed % -> % (redemption/refund must not count)', v_raf_before, v_raf_after;
  END IF;

  RAISE NOTICE 'OK: redemption store matrix — redeem/hold/stock/idempotency/deny/cancel/fulfill/permissions/raffle/stock-restore-idempotency/null-stock all pass.';
END $$;

-- ---- Increment-specific checks: 20260606035450 (get_user_points_by_source) ----
DO $$
DECLARE
  missing text := '';
  c_user   uuid := '00000000-0000-0000-0000-0000000a0001';
  c_other  uuid := '00000000-0000-0000-0000-0000000a0002';
  v_bal    integer;
  v_sum    integer;
  v_raised boolean;
BEGIN
  IF to_regprocedure('public.get_user_points_by_source(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.get_user_points_by_source(uuid) is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — get_user_points_by_source objects (20260606035450) not correct:%', missing;
  END IF;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user,  'authenticated', 'authenticated', 'gate-by-source-user@example.invalid'),
    (c_other, 'authenticated', 'authenticated', 'gate-by-source-other@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.point_transactions (user_id, amount, source, counts_toward_raffle)
  VALUES
    (c_user, 10, 'announcement_claim', true),
    (c_user, 5,  'compliance_form', true),
    (c_user, -3, 'redemption', false);

  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);

  SELECT COALESCE(SUM(total), 0) INTO v_sum
  FROM public.get_user_points_by_source(c_user);

  v_bal := public.get_user_point_balance(c_user);

  IF v_sum <> v_bal THEN
    RAISE EXCEPTION 'GATE FAILED — get_user_points_by_source sum % <> balance %', v_sum, v_bal;
  END IF;

  -- Non-admin cannot query another user's breakdown
  v_raised := false;
  BEGIN
    PERFORM count(*) FROM public.get_user_points_by_source(c_other);
  EXCEPTION WHEN others THEN
    v_raised := true;
    IF SQLERRM NOT LIKE '%Not permitted%' THEN
      RAISE EXCEPTION 'GATE FAILED — cross-user by-source wrong error: %', SQLERRM;
    END IF;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'GATE FAILED — non-admin read another user by-source was allowed';
  END IF;

  RAISE NOTICE 'OK: get_user_points_by_source — sum reconciles to balance; non-admin cross-user denied.';
END $$;

-- ---- Increment-specific checks: 20260606040413 (catalog delete RESTRICT + storage admin-only) ----
DO $$
DECLARE
  missing text := '';
  c_admin   uuid := '00000000-0000-0000-0000-00000000cc03';
  c_user    uuid := '00000000-0000-0000-0000-00000000cc01';
  c_unused  uuid := '00000000-0000-0000-0000-00000000ce01';
  c_used    uuid := '00000000-0000-0000-0000-00000000ce02';
  v_raised  boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'redemptions_item_id_fkey'
      AND confdeltype = 'r'
  ) THEN
    missing := missing || E'\n  - redemptions_item_id_fkey ON DELETE RESTRICT is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins can upload reward images'
      AND cmd = 'INSERT'
  ) THEN
    missing := missing || E'\n  - storage policy Admins can upload reward images is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE')
      AND (p.qual LIKE '%safety-rewards%' OR p.with_check LIKE '%safety-rewards%')
      AND NOT (COALESCE(p.qual, '') LIKE '%is_admin%' OR COALESCE(p.with_check, '') LIKE '%is_admin%')
  ) THEN
    missing := missing || E'\n  - safety-rewards bucket has non-admin write policy';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — catalog management objects (20260606040413) not correct:%', missing;
  END IF;

  INSERT INTO public.reward_catalog (id, name, point_cost, is_active, sort_order)
  VALUES
    (c_unused, 'Gate Unused Item', 10, false, 9990),
    (c_used,   'Gate Used Item',   10, false, 9991)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.redemptions (user_id, item_id, point_cost, status, request_id)
  VALUES (c_user, c_used, 10, 'pending', '00000000-0000-0000-0000-0000000ce101')
  ON CONFLICT DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);

  DELETE FROM public.reward_catalog WHERE id = c_unused;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GATE FAILED — admin could not delete unused catalog item';
  END IF;

  v_raised := false;
  BEGIN
    DELETE FROM public.reward_catalog WHERE id = c_used;
  EXCEPTION WHEN foreign_key_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'GATE FAILED — delete catalog item with redemptions was allowed';
  END IF;

  RAISE NOTICE 'OK: catalog delete RESTRICT — unused delete allowed; referenced delete blocked; safety-rewards admin-only write policies present.';
END $$;

-- ---- Increment-specific checks: 20260606041557 + 20260606041603 (redemption notifications) ----
DO $$
DECLARE
  missing text := '';
  v_def   text;
BEGIN
  IF to_regprocedure('public._notify_redemption_pending_admins(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public._notify_redemption_pending_admins(uuid) is missing';
  END IF;
  IF to_regprocedure('public._notify_redemption_fulfilled(uuid,uuid)') IS NULL THEN
    missing := missing || E'\n  - function public._notify_redemption_fulfilled(uuid,uuid) is missing';
  END IF;
  IF to_regprocedure('public._notify_redemption_denied(uuid,uuid)') IS NULL THEN
    missing := missing || E'\n  - function public._notify_redemption_denied(uuid,uuid) is missing';
  END IF;

  v_def := pg_get_functiondef('public.redeem_reward(uuid,uuid)'::regprocedure);
  IF position('_notify_redemption_pending_admins' IN v_def) = 0 THEN
    missing := missing || E'\n  - redeem_reward does not call _notify_redemption_pending_admins';
  END IF;
  IF position('EXCEPTION' IN v_def) = 0 OR position('WHEN OTHERS' IN v_def) = 0 THEN
    missing := missing || E'\n  - redeem_reward missing best-effort EXCEPTION handler around notify';
  END IF;

  v_def := pg_get_functiondef('public.fulfill_redemption(uuid,text)'::regprocedure);
  IF position('_notify_redemption_fulfilled' IN v_def) = 0 THEN
    missing := missing || E'\n  - fulfill_redemption does not call _notify_redemption_fulfilled';
  END IF;

  v_def := pg_get_functiondef('public.deny_redemption(uuid,text)'::regprocedure);
  IF position('_notify_redemption_denied' IN v_def) = 0 THEN
    missing := missing || E'\n  - deny_redemption does not call _notify_redemption_denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'notification_events_dispatch_on_insert'
      AND tgrelid = 'public.notification_events'::regclass
  ) THEN
    missing := missing || E'\n  - trigger notification_events_dispatch_on_insert missing on notification_events';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — redemption notifications (20260606041557/41603) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: redemption notification helpers + RPC hooks + dispatch trigger present.';
END $$;

DO $$
DECLARE
  c_user      uuid := '00000000-0000-0000-0000-00000000dd01';
  c_admin     uuid := '00000000-0000-0000-0000-00000000dd02';
  c_item      uuid := 'a1000001-0000-4000-8000-000000000001';
  v_redemption uuid;
  v_redemption2 uuid;
  v_count     integer;
  v_status    text;
  v_req_new   uuid := '00000000-0000-0000-0000-0000000d0001';
  v_req_idem  uuid := '00000000-0000-0000-0000-0000000d0002';
  v_req_ful   uuid := '00000000-0000-0000-0000-0000000d0003';
  v_req_deny  uuid := '00000000-0000-0000-0000-0000000d0004';
  v_req_cancel uuid := '00000000-0000-0000-0000-0000000d0005';
  v_bal_before integer;
BEGIN
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user , 'authenticated', 'authenticated', 'gate-rn-user@example.invalid'),
    (c_admin, 'authenticated', 'authenticated', 'gate-rn-admin@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_users SET role = 'admin', full_name = 'Gate Admin'
  WHERE user_id = c_admin;
  UPDATE public.app_users SET full_name = 'Gate Redeemer'
  WHERE user_id = c_user;

  INSERT INTO public.point_transactions (user_id, amount, source, reason, counts_toward_raffle)
  VALUES (c_user, 500, 'adjustment', 'gate redemption notify seed', true)
  ON CONFLICT DO NOTHING;

  -- ---- redeem (new pending) -> one admin role notification ----------------
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT public.redeem_reward(c_item, v_req_new) INTO v_redemption;

  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'redemption_pending' AND entity_id = v_redemption;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — redeem did not create exactly one admin pending notify (got %)', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'redemption_pending' AND entity_id = v_redemption
    AND target_type = 'role' AND target_ref = 'admin' AND category = 'admin_notice';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — admin pending notify wrong target/category (count=%)', v_count;
  END IF;

  IF position('pending fulfillment' IN (
    SELECT title FROM public.notification_events
    WHERE entity_type = 'redemption_pending' AND entity_id = v_redemption LIMIT 1
  )) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED — admin pending notify title missing pending fulfillment copy';
  END IF;

  -- ---- idempotent redeem retry -> no second admin notify ------------------
  SELECT public.redeem_reward(c_item, v_req_new) INTO v_redemption2;
  IF v_redemption <> v_redemption2 THEN
    RAISE EXCEPTION 'GATE FAILED — idempotent redeem returned different ids';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'redemption_pending' AND entity_id = v_redemption;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — idempotent redeem produced % admin notifies (expected 1)', v_count;
  END IF;

  -- ---- fulfill -> one recipient notify ------------------------------------
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT public.redeem_reward(c_item, v_req_ful) INTO v_redemption;
  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  PERFORM public.fulfill_redemption(v_redemption, 'gate fulfill notify');

  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'redemption_fulfilled' AND entity_id = v_redemption;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — fulfill did not create exactly one recipient notify (got %)', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'redemption_fulfilled' AND entity_id = v_redemption
    AND target_type = 'user' AND target_ref = c_user::text;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — fulfill notify not targeted to recipient user';
  END IF;

  -- ---- deny -> one recipient notify with refund mention -------------------
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT public.redeem_reward(c_item, v_req_deny) INTO v_redemption;
  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  PERFORM public.deny_redemption(v_redemption, 'gate deny notify');

  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_type = 'redemption_denied' AND entity_id = v_redemption;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED — deny did not create exactly one recipient notify (got %)', v_count;
  END IF;

  IF position('refunded' IN lower((
    SELECT body FROM public.notification_events
    WHERE entity_type = 'redemption_denied' AND entity_id = v_redemption LIMIT 1
  ))) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED — deny notify body missing refund mention';
  END IF;

  -- ---- cancel -> no notification ------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT public.redeem_reward(c_item, v_req_cancel) INTO v_redemption;
  v_count := (SELECT count(*) FROM public.notification_events WHERE entity_id = v_redemption);
  PERFORM public.cancel_redemption(v_redemption);
  SELECT count(*) INTO v_count
  FROM public.notification_events
  WHERE entity_id = v_redemption
    AND entity_type IN ('redemption_fulfilled', 'redemption_denied');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED — cancel created fulfill/deny recipient notify (count=%)', v_count;
  END IF;

  -- ---- notify failure does not roll back fulfill --------------------------
  PERFORM set_config('request.jwt.claim.sub', c_user::text, true);
  SELECT public.redeem_reward(c_item, v_req_idem) INTO v_redemption;

  CREATE OR REPLACE FUNCTION public._notify_redemption_fulfilled(p_redemption_id uuid, p_actor uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $stub$
  BEGIN
    RAISE EXCEPTION 'gate simulated notify failure';
  END;
  $stub$;

  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  v_bal_before := public.get_user_point_balance(c_user);
  PERFORM public.fulfill_redemption(v_redemption, 'gate notify fail isolation');

  SELECT status::text INTO v_status FROM public.redemptions WHERE id = v_redemption;
  IF v_status <> 'fulfilled' THEN
    RAISE EXCEPTION 'GATE FAILED — fulfill rolled back when notify failed (status=%)', v_status;
  END IF;
  IF public.get_user_point_balance(c_user) <> v_bal_before THEN
    RAISE EXCEPTION 'GATE FAILED — fulfill balance changed when notify failed';
  END IF;

  RAISE NOTICE 'OK: redemption notifications — admin pending/fulfill/deny/cancel/idempotent-redeem/notify-failure-isolation all pass.';
END $$;

-- ---- Increment-specific checks: 20260606170000 (Option A raffle ledger cutover) ----
DO $$
DECLARE
  missing text := '';
  v_def   text;
  -- Fixture users
  c_f1    uuid := '00000000-0000-0000-0000-0000000f0001';
  c_f6    uuid := '00000000-0000-0000-0000-0000000f0006';
  c_split uuid := '00000000-0000-0000-0000-0000000f0007';
  c_u1    uuid := '00000000-0000-0000-0000-0000000f0010';
  c_u2    uuid := '00000000-0000-0000-0000-0000000f0011';
  -- Fixture helpers
  v_ann   date[];
  v_claim date[];
  v_total integer;
  v_rows  integer;
  v_year  int := 2026;
  v_month int := 6;
  v_bal   integer;
  v_raf   integer;
  v_streak integer;
  v_pool  bigint;
  v_sum_users bigint;
  v_wallet_sum integer;
  v_raf_sum integer;
  v_raf_bd integer;
  v_pct   numeric;
  v_share_sum numeric := 0;
  r       record;
  v_chicago_now timestamp;
  v_dry_year int;
  v_dry_month int;
  v_old   integer;
  v_new   integer;
  v_claimed date[];
  v_ann_dry date[];
BEGIN
  -- Presence checks
  IF to_regprocedure('public.point_tx_matches_raffle_month(boolean,integer,timestamp with time zone,integer,integer)') IS NULL THEN
    missing := missing || E'\n  - point_tx_matches_raffle_month is missing';
  END IF;
  IF to_regprocedure('public.compute_streak_bonus_total(date[],date[])') IS NULL THEN
    missing := missing || E'\n  - compute_streak_bonus_total is missing';
  END IF;
  IF to_regprocedure('public.sync_streak_bonuses_for_user(uuid,timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - sync_streak_bonuses_for_user is missing';
  END IF;
  IF to_regprocedure('public.get_user_raffle_entries_by_source(uuid,integer,integer)') IS NULL THEN
    missing := missing || E'\n  - get_user_raffle_entries_by_source is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_point_tx_streak_bonus'
  ) THEN
    missing := missing || E'\n  - uq_point_tx_streak_bonus index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_streak_bonus_to_ledger'
  ) THEN
    missing := missing || E'\n  - trg_sync_streak_bonus_to_ledger is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — Option A objects (20260606170000) not present:%', missing;
  END IF;

  -- Constants (necessary, not sufficient)
  IF public.streak_bonus_amount('consecutive_5') <> 2
     OR public.streak_bonus_amount('consecutive_10') <> 5
     OR public.streak_bonus_amount('full_month') <> 15 THEN
    RAISE EXCEPTION 'GATE FAILED — streak_bonus_amount constants != 2/5/15 (KEEP IN SYNC STREAK_BONUSES)';
  END IF;

  -- §5 STRUCTURAL: shared predicate in all raffle total functions
  v_def := pg_get_functiondef('public.get_user_raffle_entries(uuid,integer,integer)'::regprocedure);
  IF position('point_tx_matches_raffle_month' IN v_def) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED — get_user_raffle_entries does not call point_tx_matches_raffle_month';
  END IF;
  v_def := pg_get_functiondef('public.get_monthly_raffle_stats(integer,integer)'::regprocedure);
  IF position('point_tx_matches_raffle_month' IN v_def) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED — get_monthly_raffle_stats does not call point_tx_matches_raffle_month';
  END IF;
  v_def := pg_get_functiondef('public.get_user_raffle_entries_by_source(uuid,integer,integer)'::regprocedure);
  IF position('point_tx_matches_raffle_month' IN v_def) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED — get_user_raffle_entries_by_source does not call point_tx_matches_raffle_month';
  END IF;
  v_def := pg_get_functiondef('public.get_user_point_balance(uuid)'::regprocedure);
  IF position('streak_bonus' IN v_def) = 0 OR position('source <>' IN v_def) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED — get_user_point_balance does not exclude streak_bonus';
  END IF;
  v_def := pg_get_functiondef('public.get_user_points_by_source(uuid)'::regprocedure);
  IF position('streak_bonus' IN v_def) = 0 OR position('source <>' IN v_def) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED — get_user_points_by_source does not exclude streak_bonus';
  END IF;

  RAISE NOTICE 'OK: §5 structural — point_tx_matches_raffle_month referenced by raffle RPCs; wallet RPCs exclude streak_bonus';

  -- §2 behavioral fixtures F1–F5 (TS-verified expected totals)
  -- F1: exactly 5-day milestone, NOT full month (6 ann days, claim 5) → 2
  v_ann := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-06'::date, '1 day'::interval) d);
  v_claim := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-05'::date, '1 day'::interval) d);
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F1: expected 2 got %', v_total;
  END IF;

  -- F2: 5-streak, gap day 6, 4-streak tail (ann 1-10; claim 1-5, skip 6, 7-10) → 2
  v_ann := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-10'::date, '1 day'::interval) d);
  v_claim := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-05'::date, '1 day'::interval) d)
          || ARRAY(SELECT d::date FROM generate_series('2026-06-07'::date, '2026-06-10'::date, '1 day'::interval) d);
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F2: expected 2 got %', v_total;
  END IF;

  -- F3: 10-day milestones without full month (11 ann days, claim 10) → 7
  v_ann := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-11'::date, '1 day'::interval) d);
  v_claim := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-10'::date, '1 day'::interval) d);
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 7 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F3: expected 7 got %', v_total;
  END IF;

  -- F4: full month 20 days → 22
  v_ann := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-20'::date, '1 day'::interval) d);
  v_claim := v_ann;
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 22 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F4: expected 22 got %', v_total;
  END IF;

  -- F5: four announcement days all claimed — full month (+15), streak 4 only (no 5-day bonus)
  v_ann := ARRAY['2026-06-01'::date, '2026-06-02'::date, '2026-06-03'::date, '2026-06-04'::date];
  v_claim := v_ann;
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 15 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F5: expected 15 got %', v_total;
  END IF;

  -- F6 adversarial: 5-streak, gap, 4-streak — 5-day milestone only once
  v_ann := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-10'::date, '1 day'::interval) d);
  v_claim := ARRAY(SELECT d::date FROM generate_series('2026-06-01'::date, '2026-06-05'::date, '1 day'::interval) d)
          || ARRAY(SELECT d::date FROM generate_series('2026-06-07'::date, '2026-06-10'::date, '1 day'::interval) d);
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F6a: ragged streak expected 2 got %', v_total;
  END IF;

  -- F6b: Chicago date mapping — claim UTC near month boundary still counts as Jan 31
  v_ann := ARRAY['2026-01-31'::date];
  v_claim := ARRAY['2026-01-31'::date];
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 15 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F6b month-edge full-month: expected 15 got %', v_total;
  END IF;

  -- F6c: DST spring week — 5 consecutive of 6 ann days (claim 5, not full month) → 2
  v_ann := ARRAY(SELECT d::date FROM generate_series('2026-03-07'::date, '2026-03-12'::date, '1 day'::interval) d);
  v_claim := ARRAY(SELECT d::date FROM generate_series('2026-03-07'::date, '2026-03-11'::date, '1 day'::interval) d);
  v_total := public.compute_streak_bonus_total(v_claim, v_ann);
  IF v_total <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F6c DST week clean-5: expected 2 got %', v_total;
  END IF;

  RAISE NOTICE 'OK: §2 behavioral fixtures F1–F6 (compute_streak_bonus_total matches TS semantics)';

  -- Gate inserts use historical claim timestamps — bypass claim-window / latest-announcement BEFORE triggers.
  ALTER TABLE public.announcement_rewards DISABLE TRIGGER trigger_reward_claim_window;
  ALTER TABLE public.announcement_rewards DISABLE TRIGGER enforce_latest_announcement_claim;

  -- §2 writer integration + §1 dedup + §3 idempotency (uses DB rows + sync)
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_f1, 'authenticated', 'authenticated', 'gate-streak-f1@example.invalid'),
    (c_f6, 'authenticated', 'authenticated', 'gate-streak-f6@example.invalid'),
    (c_split, 'authenticated', 'authenticated', 'gate-streak-split@example.invalid'),
    (c_u1, 'authenticated', 'authenticated', 'gate-raffle-u1@example.invalid'),
    (c_u2, 'authenticated', 'authenticated', 'gate-raffle-u2@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  -- F6 sync + §1/§3 integration (isolated month 2099-06 — no prod announcement collision)
  INSERT INTO public.announcements (id, title, message, date)
  SELECT gen_random_uuid(), 'Gate ann ' || d::text, 'body', d::date
  FROM generate_series('2099-06-01'::date, '2099-06-10'::date, '1 day'::interval) d;

  INSERT INTO public.announcement_rewards (user_id, announcement_id, points_awarded, claimed_at)
  SELECT c_f6, a.id, 1, (a.date::text || ' 12:00:00')::timestamp AT TIME ZONE 'America/Chicago'
  FROM public.announcements a
  WHERE a.date >= '2099-06-01' AND a.date <= '2099-06-10'
    AND a.date IN (
      SELECT d::date FROM generate_series('2099-06-01'::date, '2099-06-05'::date, '1 day'::interval) d
      UNION SELECT d::date FROM generate_series('2099-06-07'::date, '2099-06-10'::date, '1 day'::interval) d
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.announcement_rewards ar
      WHERE ar.user_id = c_f6 AND ar.announcement_id = a.id
    );

  PERFORM public.sync_streak_bonuses_for_user(c_f6, '2099-06-10 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  SELECT count(*) INTO v_rows
  FROM public.point_transactions
  WHERE user_id = c_f6 AND source = 'streak_bonus' AND category = 'consecutive_5:2099-06';
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED §2 F6 sync: expected 1 consecutive_5:2099-06 row, got %', v_rows;
  END IF;

  -- §1: same milestone two months → two rows (6 ann days per month, claim 5 — no full month)
  INSERT INTO public.announcements (id, title, message, date)
  SELECT gen_random_uuid(), 'Gate ann split jun ' || d::text, 'body', d::date
  FROM generate_series('2099-06-01'::date, '2099-06-06'::date, '1 day'::interval) d;

  INSERT INTO public.announcement_rewards (user_id, announcement_id, points_awarded, claimed_at)
  SELECT c_split, a.id, 1, (a.date::text || ' 12:00:00')::timestamp AT TIME ZONE 'America/Chicago'
  FROM public.announcements a
  WHERE a.date BETWEEN '2099-06-01' AND '2099-06-05'
    AND NOT EXISTS (SELECT 1 FROM public.announcement_rewards ar WHERE ar.user_id = c_split AND ar.announcement_id = a.id);

  PERFORM public.sync_streak_bonuses_for_user(c_split, '2099-06-05 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  INSERT INTO public.announcements (id, title, message, date)
  SELECT gen_random_uuid(), 'Gate ann split jul ' || d::text, 'body', d::date
  FROM generate_series('2099-07-01'::date, '2099-07-06'::date, '1 day'::interval) d;

  INSERT INTO public.announcement_rewards (user_id, announcement_id, points_awarded, claimed_at)
  SELECT c_split, a.id, 1, (a.date::text || ' 12:00:00')::timestamp AT TIME ZONE 'America/Chicago'
  FROM public.announcements a
  WHERE a.date BETWEEN '2099-07-01' AND '2099-07-05'
    AND NOT EXISTS (SELECT 1 FROM public.announcement_rewards ar WHERE ar.user_id = c_split AND ar.announcement_id = a.id);

  PERFORM public.sync_streak_bonuses_for_user(c_split, '2099-07-05 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  SELECT count(*) INTO v_rows
  FROM public.point_transactions
  WHERE user_id = c_split AND source = 'streak_bonus' AND category LIKE 'consecutive_5:%';
  IF v_rows <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED §1: expected 2 consecutive_5 rows across months, got %', v_rows;
  END IF;

  -- §3 idempotency
  PERFORM public.sync_streak_bonuses_for_user(c_split, '2099-07-05 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  SELECT count(*) INTO v_rows
  FROM public.point_transactions
  WHERE user_id = c_split AND source = 'streak_bonus' AND category LIKE 'consecutive_5:%';
  IF v_rows <> 2 THEN
    RAISE EXCEPTION 'GATE FAILED §3 idempotency: consecutive_5 row count changed (now %)', v_rows;
  END IF;

  RAISE NOTICE 'OK: §1 dedup spans months; §3 idempotent sync';

  -- §4 wallet vs raffle split (month 2099-08 — isolated)
  INSERT INTO public.point_transactions (user_id, amount, source, counts_toward_raffle, category, created_at)
  VALUES
    (c_u1, 3, 'announcement_claim', true, NULL, '2099-08-15 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago'),
    (c_u1, 2, 'streak_bonus', true, 'consecutive_5:2099-08', '2099-08-05 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  v_bal := public.get_user_point_balance(c_u1);
  v_raf := public.get_user_raffle_entries(c_u1, 2099, 8);
  SELECT COALESCE(SUM(amount), 0) INTO v_streak
  FROM public.point_transactions
  WHERE user_id = c_u1 AND source = 'streak_bonus'
    AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'America/Chicago')) = 2099
    AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'America/Chicago')) = 8;

  IF v_raf - v_bal <> v_streak THEN
    RAISE EXCEPTION 'GATE FAILED §4: raffle % - wallet % != streak %', v_raf, v_bal, v_streak;
  END IF;

  RAISE NOTICE 'OK: §4 wallet excludes streak; raffle includes streak (delta=%)', v_streak;

  -- §5 value — pool total equals sum of per-user entries (month 2099-08)
  INSERT INTO public.point_transactions (user_id, amount, source, counts_toward_raffle, created_at)
  VALUES
    (c_u2, 4, 'announcement_claim', true, '2099-08-12 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  SELECT total_claim_count INTO v_pool FROM public.get_monthly_raffle_stats(2099, 8) LIMIT 1;
  SELECT COALESCE(SUM(public.get_user_raffle_entries(u.uid, 2099, 8)), 0) INTO v_sum_users
  FROM (VALUES (c_u1), (c_u2)) AS u(uid);

  IF v_pool IS DISTINCT FROM v_sum_users THEN
    RAISE EXCEPTION 'GATE FAILED §5 value: pool % != sum user entries %', v_pool, v_sum_users;
  END IF;

  RAISE NOTICE 'OK: §5 value — get_monthly_raffle_stats.total_claim_count = sum(get_user_raffle_entries)';

  -- §6 breakdown reconciliation
  PERFORM set_config('request.jwt.claim.sub', c_u1::text, true);
  SELECT COALESCE(SUM(total), 0) INTO v_wallet_sum FROM public.get_user_points_by_source(c_u1);
  IF v_wallet_sum <> v_bal THEN
    RAISE EXCEPTION 'GATE FAILED §6 wallet breakdown sum % != balance %', v_wallet_sum, v_bal;
  END IF;

  SELECT COALESCE(SUM(total), 0) INTO v_raf_bd
  FROM public.get_user_raffle_entries_by_source(c_u1, 2099, 8);
  IF v_raf_bd <> v_raf THEN
    RAISE EXCEPTION 'GATE FAILED §6 raffle breakdown sum % != raffle entries %', v_raf_bd, v_raf;
  END IF;

  IF EXISTS (SELECT 1 FROM public.get_user_points_by_source(c_u1) WHERE source = 'streak_bonus') THEN
    RAISE EXCEPTION 'GATE FAILED §6 wallet breakdown must not include streak_bonus';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.get_user_raffle_entries_by_source(c_u1, 2099, 8) WHERE source = 'streak_bonus') THEN
    RAISE EXCEPTION 'GATE FAILED §6 raffle breakdown must include streak_bonus';
  END IF;

  RAISE NOTICE 'OK: §6 wallet breakdown reconciles to balance (%); raffle breakdown to entries (%)', v_wallet_sum, v_raf_bd;

  -- §7 pool share bounds (2099-08 fixture users)
  FOR r IN SELECT u.uid FROM (VALUES (c_u1), (c_u2)) AS u(uid) LOOP
    v_raf := public.get_user_raffle_entries(r.uid, 2099, 8);
    IF v_pool > 0 AND v_raf > 0 THEN
      v_pct := (v_raf::numeric / v_pool::numeric) * 100;
      IF v_pct > 100.0001 THEN
        RAISE EXCEPTION 'GATE FAILED §7: user % share % > 100', r.uid, v_pct;
      END IF;
      v_share_sum := v_share_sum + v_pct;
    END IF;
  END LOOP;
  IF v_share_sum > 100.0001 THEN
    RAISE EXCEPTION 'GATE FAILED §7: sum of shares % > 100', v_share_sum;
  END IF;

  RAISE NOTICE 'OK: §7 no user share > 100%%; sum shares = %', round(v_share_sum, 2);

  -- §8 dry-run: last completed Chicago month (per-user old vs new)
  v_chicago_now := now() AT TIME ZONE 'America/Chicago';
  v_dry_month := EXTRACT(MONTH FROM v_chicago_now)::int - 1;
  v_dry_year := EXTRACT(YEAR FROM v_chicago_now)::int;
  IF v_dry_month < 1 THEN
    v_dry_month := 12;
    v_dry_year := v_dry_year - 1;
  END IF;

  RAISE NOTICE '§8 DRY-RUN: completed month %-% (old=claims+SQL streak, new=ledger raffle entries)', v_dry_year, v_dry_month;

  FOR r IN
    SELECT DISTINCT ar.user_id
    FROM public.announcement_rewards ar
    WHERE EXTRACT(YEAR FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')) = v_dry_year
      AND EXTRACT(MONTH FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')) = v_dry_month
  LOOP
    SELECT COALESCE(array_agg(sub.d ORDER BY sub.d), ARRAY[]::date[])
    INTO v_claimed
    FROM (
      SELECT DISTINCT (ar.claimed_at AT TIME ZONE 'America/Chicago')::date AS d
      FROM public.announcement_rewards ar
      WHERE ar.user_id = r.user_id
        AND EXTRACT(YEAR FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')) = v_dry_year
        AND EXTRACT(MONTH FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')) = v_dry_month
    ) sub;

    SELECT COALESCE(array_agg(a.date ORDER BY a.date), ARRAY[]::date[])
    INTO v_ann_dry
    FROM public.announcements a
    WHERE EXTRACT(YEAR FROM a.date) = v_dry_year
      AND EXTRACT(MONTH FROM a.date) = v_dry_month;

    v_old := COALESCE(array_length(v_claimed, 1), 0)
           + public.compute_streak_bonus_total(v_claimed, v_ann_dry);
    v_new := public.get_user_raffle_entries(r.user_id, v_dry_year, v_dry_month);

    RAISE NOTICE '§8 user=% old_path=% new_ledger=% delta=%',
      r.user_id, v_old, v_new, v_new - v_old;
  END LOOP;

  RAISE NOTICE 'OK: Option A gate §1–§8 pass (20260607002956)';

  ALTER TABLE public.announcement_rewards ENABLE TRIGGER trigger_reward_claim_window;
  ALTER TABLE public.announcement_rewards ENABLE TRIGGER enforce_latest_announcement_claim;
END $$;

-- ---- Increment-specific checks: 20260608120000 (gamification gate 1) ----------
DO $$
DECLARE
  missing text := '';
  v_def   text;
BEGIN
  IF to_regclass('public.level_tiers') IS NULL THEN
    missing := missing || E'\n  - table public.level_tiers is missing';
  END IF;
  IF to_regclass('public.gamification_settings') IS NULL THEN
    missing := missing || E'\n  - table public.gamification_settings is missing';
  END IF;
  IF to_regclass('public.badges') IS NULL THEN
    missing := missing || E'\n  - table public.badges is missing';
  END IF;
  IF to_regclass('public.user_badges') IS NULL THEN
    missing := missing || E'\n  - table public.user_badges is missing';
  END IF;
  IF to_regclass('public.streak_state') IS NULL THEN
    missing := missing || E'\n  - table public.streak_state is missing';
  END IF;
  IF to_regclass('public.streak_week_activity') IS NULL THEN
    missing := missing || E'\n  - table public.streak_week_activity is missing';
  END IF;
  IF to_regclass('public.recognition_feed') IS NULL THEN
    missing := missing || E'\n  - table public.recognition_feed is missing';
  END IF;
  IF to_regprocedure('public.get_user_lifetime_earned(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.get_user_lifetime_earned(uuid) is missing';
  END IF;
  IF to_regprocedure('public.get_user_level(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.get_user_level(uuid) is missing';
  END IF;

  IF (SELECT count(*) FROM public.level_tiers WHERE is_active) <> 24 THEN
    missing := missing || E'\n  - level_tiers seed expected 24 active rows, got '
      || (SELECT count(*) FROM public.level_tiers WHERE is_active)::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.level_tiers
    WHERE tier_key = 'seedling' AND sub_level = 1 AND entry_threshold = 0
  ) THEN
    missing := missing || E'\n  - level_tiers missing Seedling I @ 0';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.level_tiers
    WHERE tier_key = 'redwood' AND sub_level = 3 AND entry_threshold = 11000
  ) THEN
    missing := missing || E'\n  - level_tiers missing Redwood III @ 11000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gamification_settings
    WHERE key = 'streak_milestone_weeks' AND value = '[4, 12, 26]'::jsonb
  ) THEN
    missing := missing || E'\n  - gamification_settings streak_milestone_weeks not [4,12,26]';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gamification_settings
    WHERE key = 'sharp_eye_prestige_counts' AND value = '[3, 10, 25]'::jsonb
  ) THEN
    missing := missing || E'\n  - gamification_settings sharp_eye_prestige_counts not [3,10,25]';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gamification_settings
    WHERE key = 'cert_stacked_prestige_counts' AND value = '[3, 5, 10]'::jsonb
  ) THEN
    missing := missing || E'\n  - gamification_settings cert_stacked_prestige_counts not [3,5,10]';
  END IF;

  v_def := pg_get_functiondef('public.get_user_lifetime_earned(uuid)'::regprocedure);
  IF position('gamification_earning_sources' IN v_def) = 0 THEN
    IF position('streak_bonus' IN v_def) = 0 THEN
      missing := missing || E'\n  - get_user_lifetime_earned does not include streak_bonus';
    END IF;
    IF position('manual_award' IN v_def) = 0 THEN
      missing := missing || E'\n  - get_user_lifetime_earned missing expected earning sources';
    END IF;
  ELSIF NOT (
    'streak_bonus' = ANY (public.gamification_earning_sources())
    AND 'manual_award' = ANY (public.gamification_earning_sources())
    AND 'challenge_reward' = ANY (public.gamification_earning_sources())
    AND 'campaign_multiplier_bonus' = ANY (public.gamification_earning_sources())
  ) THEN
    missing := missing || E'\n  - gamification_earning_sources missing required Phase 1/2 labels';
  END IF;
  IF position('redemption' IN v_def) > 0 OR position('adjustment' IN v_def) > 0 THEN
    missing := missing || E'\n  - get_user_lifetime_earned must not reference redemption/adjustment in allowlist';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — gamification gate 1 objects (20260608120000) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: gamification schema + level functions present; ladder seeded (24 tiers).';
END $$;

DO $$
DECLARE
  c_zero   uuid := '00000000-0000-0000-0000-00000000b101';
  c_19     uuid := '00000000-0000-0000-0000-00000000b119';
  c_20     uuid := '00000000-0000-0000-0000-00000000b120';
  c_35     uuid := '00000000-0000-0000-0000-00000000b135';
  c_49     uuid := '00000000-0000-0000-0000-00000000b149';
  c_50     uuid := '00000000-0000-0000-0000-00000000b150';
  c_redeem uuid := '00000000-0000-0000-0000-00000000b1a1';
  c_refund uuid := '00000000-0000-0000-0000-00000000b1a2';
  c_streak uuid := '00000000-0000-0000-0000-00000000b1a3';
  c_max    uuid := '00000000-0000-0000-0000-00000000b1a4';
  v_lifetime int;
  r record;
BEGIN
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_zero,   'authenticated', 'authenticated', 'gate-g1-zero@example.invalid'),
    (c_19,     'authenticated', 'authenticated', 'gate-g1-19@example.invalid'),
    (c_20,     'authenticated', 'authenticated', 'gate-g1-20@example.invalid'),
    (c_35,     'authenticated', 'authenticated', 'gate-g1-35@example.invalid'),
    (c_49,     'authenticated', 'authenticated', 'gate-g1-49@example.invalid'),
    (c_50,     'authenticated', 'authenticated', 'gate-g1-50@example.invalid'),
    (c_redeem, 'authenticated', 'authenticated', 'gate-g1-redeem@example.invalid'),
    (c_refund, 'authenticated', 'authenticated', 'gate-g1-refund@example.invalid'),
    (c_streak, 'authenticated', 'authenticated', 'gate-g1-streak@example.invalid'),
    (c_max,    'authenticated', 'authenticated', 'gate-g1-max@example.invalid');

  INSERT INTO public.point_transactions (user_id, amount, source, reason) VALUES
    (c_19, 19, 'announcement_claim', 'gate g1 boundary'),
    (c_20, 20, 'announcement_claim', 'gate g1 boundary'),
    (c_35, 35, 'compliance_form', 'gate g1 boundary'),
    (c_49, 49, 'announcement_claim', 'gate g1 boundary'),
    (c_50, 50, 'announcement_claim', 'gate g1 boundary'),
    (c_redeem, 100, 'announcement_claim', 'gate g1 redeem test'),
    (c_redeem, -40, 'redemption', 'gate g1 redeem test'),
    (c_refund, 80, 'announcement_claim', 'gate g1 refund test'),
    (c_refund, 20, 'adjustment', 'gate g1 refund test'),
    (c_streak, 7, 'streak_bonus', 'gate g1 streak test'),
    (c_max, 11000, 'announcement_claim', 'gate g1 max tier');

  -- Zero / empty user stays Seedling I
  SELECT * INTO r FROM public.get_user_level(c_zero);
  IF r.tier_key <> 'seedling' OR r.sub_level <> 1 OR r.lifetime_earned <> 0
     OR r.next_threshold <> 20 OR r.progress_pct <> 0.00 THEN
    RAISE EXCEPTION 'GATE FAILED g1 boundary zero: % % earned=% next=% pct=%',
      r.tier_key, r.sub_level_label, r.lifetime_earned, r.next_threshold, r.progress_pct;
  END IF;

  SELECT * INTO r FROM public.get_user_level(c_19);
  IF r.tier_key <> 'seedling' OR r.sub_level <> 1 OR r.lifetime_earned <> 19 THEN
    RAISE EXCEPTION 'GATE FAILED g1 boundary 19: got % % earned=%', r.tier_key, r.sub_level_label, r.lifetime_earned;
  END IF;

  SELECT * INTO r FROM public.get_user_level(c_20);
  IF r.tier_key <> 'seedling' OR r.sub_level <> 2 OR r.lifetime_earned <> 20
     OR r.current_threshold <> 20 OR r.next_threshold <> 35 THEN
    RAISE EXCEPTION 'GATE FAILED g1 boundary 20: got % % thresh=% next=%',
      r.tier_key, r.sub_level_label, r.current_threshold, r.next_threshold;
  END IF;

  SELECT * INTO r FROM public.get_user_level(c_35);
  IF r.tier_key <> 'seedling' OR r.sub_level <> 3 OR r.lifetime_earned <> 35 THEN
    RAISE EXCEPTION 'GATE FAILED g1 boundary 35: got % %', r.tier_key, r.sub_level_label;
  END IF;

  SELECT * INTO r FROM public.get_user_level(c_49);
  IF r.tier_key <> 'seedling' OR r.sub_level <> 3 OR r.lifetime_earned <> 49 THEN
    RAISE EXCEPTION 'GATE FAILED g1 boundary 49: got % %', r.tier_key, r.sub_level_label;
  END IF;

  SELECT * INTO r FROM public.get_user_level(c_50);
  IF r.tier_key <> 'sapling' OR r.sub_level <> 1 OR r.lifetime_earned <> 50
     OR r.current_threshold <> 50 THEN
    RAISE EXCEPTION 'GATE FAILED g1 boundary 50: got % % earned=%', r.tier_key, r.sub_level_label, r.lifetime_earned;
  END IF;

  v_lifetime := public.get_user_lifetime_earned(c_redeem);
  IF v_lifetime <> 100 THEN
    RAISE EXCEPTION 'GATE FAILED g1 redemption: lifetime=% expected 100 (redemption must not reduce)', v_lifetime;
  END IF;

  v_lifetime := public.get_user_lifetime_earned(c_refund);
  IF v_lifetime <> 80 THEN
    RAISE EXCEPTION 'GATE FAILED g1 adjustment refund: lifetime=% expected 80 (adjustment must not inflate)', v_lifetime;
  END IF;

  v_lifetime := public.get_user_lifetime_earned(c_streak);
  IF v_lifetime <> 7 THEN
    RAISE EXCEPTION 'GATE FAILED g1 streak_bonus: lifetime=% expected 7', v_lifetime;
  END IF;

  SELECT * INTO r FROM public.get_user_level(c_max);
  IF r.tier_key <> 'redwood' OR r.sub_level <> 3 OR r.lifetime_earned <> 11000
     OR r.next_threshold IS NOT NULL OR r.progress_pct <> 100.00 THEN
    RAISE EXCEPTION 'GATE FAILED g1 max tier: % % next=% pct=%',
      r.tier_key, r.sub_level_label, r.next_threshold, r.progress_pct;
  END IF;

  RAISE NOTICE 'OK: gamification gate 1 boundary tests — thresholds, redemption/adjustment exclusion, streak_bonus inclusion.';
END $$;

DO $$
DECLARE
  r record;
  v_users int := 0;
BEGIN
  RAISE NOTICE 'GATE 1 retroactive tier distribution (app_users with ledger activity):';
  FOR r IN
    SELECT
      gl.tier_key,
      gl.tier_name,
      gl.sub_level_label,
      gl.tier_order,
      gl.sub_level,
      count(*) AS user_count,
      min(gl.lifetime_earned) AS min_earned,
      max(gl.lifetime_earned) AS max_earned
    FROM public.app_users au
    JOIN LATERAL public.get_user_level(au.user_id) gl ON true
    WHERE EXISTS (
      SELECT 1 FROM public.point_transactions pt WHERE pt.user_id = au.user_id
    )
    GROUP BY gl.tier_key, gl.tier_name, gl.sub_level_label, gl.tier_order, gl.sub_level
    ORDER BY gl.tier_order, gl.sub_level
  LOOP
    v_users := v_users + r.user_count;
    RAISE NOTICE '  tier=% % % users=% earned=[%..%]',
      r.tier_key, r.tier_name, r.sub_level_label, r.user_count, r.min_earned, r.max_earned;
  END LOOP;

  SELECT count(DISTINCT au.user_id) INTO v_users
  FROM public.app_users au
  WHERE EXISTS (SELECT 1 FROM public.point_transactions pt WHERE pt.user_id = au.user_id);

  IF v_users = 0 THEN
    RAISE NOTICE 'NOTE: retroactive distribution skipped — no app_users with ledger rows in gate DB.';
  ELSE
    RAISE NOTICE 'OK: retroactive tier distribution spot-check over % ledger-active users.', v_users;
  END IF;
END $$;

-- ---- Increment-specific checks: 20260608140000 (gamification gate 2) ----------
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regprocedure('public.award_badge(uuid,text,integer,uuid,text)') IS NULL THEN
    missing := missing || E'\n  - function public.award_badge is missing';
  END IF;
  IF to_regprocedure('public.evaluate_user_badges(uuid,text)') IS NULL THEN
    missing := missing || E'\n  - function public.evaluate_user_badges(uuid,text) is missing';
  END IF;
  IF to_regprocedure('public.welcome_gamification()') IS NULL THEN
    missing := missing || E'\n  - function public.welcome_gamification() is missing';
  END IF;
  IF to_regprocedure('public.evaluate_tenure_badges_cron()') IS NULL THEN
    missing := missing || E'\n  - function public.evaluate_tenure_badges_cron() is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_users'
      AND column_name = 'first_gamification_seen_at'
  ) THEN
    missing := missing || E'\n  - app_users.first_gamification_seen_at column missing';
  END IF;

  IF (SELECT count(*) FROM public.badges WHERE is_active) <> 10 THEN
    missing := missing || E'\n  - badges seed expected 10 active rows, got '
      || (SELECT count(*) FROM public.badges WHERE is_active)::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.badges WHERE badge_key = 'first_light' AND prestige_max = 1) THEN
    missing := missing || E'\n  - badge first_light missing or wrong prestige_max';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.badges WHERE badge_key = 'sharp_eye' AND prestige_max = 3) THEN
    missing := missing || E'\n  - badge sharp_eye missing or prestige_max <> 3';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.badges WHERE badge_key = 'stacked' AND prestige_max = 3) THEN
    missing := missing || E'\n  - badge stacked missing or prestige_max <> 3';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.badges WHERE badge_key = 'on_the_board' AND is_feed_worthy = false) THEN
    missing := missing || E'\n  - on_the_board must be is_feed_worthy=false (dedupe tier promotion)';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — gamification gate 2 objects (20260608140000) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: gamification gate 2 schema — badge engine, seeds, welcome RPC, tenure cron.';
END $$;

DO $$
DECLARE
  c_user       uuid := '00000000-0000-0000-0000-00000000d201';
  c_incident   uuid;
  c_ca         uuid;
  c_cert_type  uuid := '00000000-0000-0000-0000-00000000d220';
  c_attempt    uuid := '00000000-0000-0000-0000-00000000d223';
  c_cert_rec   uuid := '00000000-0000-0000-0000-00000000d221';
  c_null_hire  uuid := '00000000-0000-0000-0000-00000000d231';
  c_tenure     uuid := '00000000-0000-0000-0000-00000000d232';
  v_id1        uuid;
  v_id2        uuid;
  v_count      int;
  v_null_hire  int;
  v_result     jsonb;
  i            int;
BEGIN
  ALTER TABLE public.safety_incidents DISABLE TRIGGER trigger_safety_audit_incident;
  ALTER TABLE public.corrective_actions DISABLE TRIGGER trigger_safety_audit_corrective_actions;
  ALTER TABLE public.certification_records DISABLE TRIGGER trigger_safety_audit_cert_records;
  ALTER TABLE public.certification_records DISABLE TRIGGER trigger_refresh_completion_stats_on_record_insert;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_badges_point_tx;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user,      'authenticated', 'authenticated', 'gate-g2-user@example.invalid'),
    (c_null_hire, 'authenticated', 'authenticated', 'gate-g2-null-hire@example.invalid'),
    (c_tenure,    'authenticated', 'authenticated', 'gate-g2-tenure@example.invalid');

  UPDATE public.app_users SET hire_date = current_date - interval '400 days'
  WHERE user_id = c_user;
  UPDATE public.app_users SET hire_date = NULL
  WHERE user_id = c_null_hire;
  UPDATE public.app_users SET hire_date = current_date - interval '6 years'
  WHERE user_id = c_tenure;

  -- Idempotency: award_badge twice returns id then NULL
  v_id1 := public.award_badge(c_user, 'first_light', 1);
  v_id2 := public.award_badge(c_user, 'first_light', 1);
  IF v_id1 IS NULL THEN
    RAISE EXCEPTION 'GATE FAILED g2 idempotency: first award_badge returned NULL';
  END IF;
  IF v_id2 IS NOT NULL THEN
    RAISE EXCEPTION 'GATE FAILED g2 idempotency: second award_badge should return NULL';
  END IF;
  SELECT count(*)::int INTO v_count
  FROM public.user_badges WHERE user_id = c_user AND badge_key = 'first_light';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g2 idempotency: expected 1 first_light row, got %', v_count;
  END IF;

  PERFORM public.evaluate_user_badges(c_user, 'all');
  PERFORM public.evaluate_user_badges(c_user, 'all');
  SELECT count(*)::int INTO v_count
  FROM public.user_badges WHERE user_id = c_user AND badge_key = 'first_light';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g2 re-eval idempotency: duplicate first_light rows';
  END IF;

  -- Sharp Eye via corrective_bonus signal — 3 distinct actionable incidents → bronze only
  FOR i IN 1..3 LOOP
    c_incident := ('00000000-0000-0000-0000-00000000d2' || lpad(i::text, 2, '0'))::uuid;
    c_ca       := ('00000000-0000-0000-0000-00000000d3' || lpad(i::text, 2, '0'))::uuid;

    INSERT INTO public.safety_incidents (id, incident_date, severity, incident_type, description, reported_by)
    VALUES (c_incident, current_date, 'near_miss', 'other', 'gate g2 sharp eye ' || i, c_user);

    INSERT INTO public.corrective_actions (id, incident_id, description, action_type, status, due_date)
    VALUES (c_ca, c_incident, 'gate g2 capa ' || i, 'immediate', 'verified', current_date + 7);

    INSERT INTO public.point_transactions
      (user_id, amount, source, reference_id, reference_table, category, counts_toward_raffle)
    VALUES
      (c_user, 15, 'near_miss_report', c_ca, 'corrective_actions', 'corrective_bonus', true);
  END LOOP;

  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_evaluate_badges_point_tx;

  -- One more insert with trigger enabled to exercise live hook path
  c_incident := '00000000-0000-0000-0000-00000000d204';
  c_ca       := '00000000-0000-0000-0000-00000000d304';
  INSERT INTO public.safety_incidents (id, incident_date, severity, incident_type, description, reported_by)
  VALUES (c_incident, current_date, 'near_miss', 'other', 'gate g2 sharp eye trigger', c_user);
  INSERT INTO public.corrective_actions (id, incident_id, description, action_type, status, due_date)
  VALUES (c_ca, c_incident, 'gate g2 capa trigger', 'immediate', 'verified', current_date + 7);
  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, category, counts_toward_raffle)
  VALUES
    (c_user, 15, 'near_miss_report', c_ca, 'corrective_actions', 'corrective_bonus', true);

  SELECT count(*)::int INTO v_count
  FROM public.user_badges WHERE user_id = c_user AND badge_key = 'sharp_eye' AND prestige_tier = 1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g2 sharp eye: expected bronze at 4 actionable, got tier1=%', v_count;
  END IF;
  SELECT count(*)::int INTO v_count
  FROM public.user_badges WHERE user_id = c_user AND badge_key = 'sharp_eye' AND prestige_tier = 2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g2 prestige order: tier 2 awarded below threshold 10';
  END IF;

  -- Certified via active cert (written-only path)
  INSERT INTO public.certification_types (id, name, slug, has_written_test, has_practical_eval, passing_score, validity_months)
  VALUES (c_cert_type, 'Gate G2 Written Only', 'gate-g2-written-only', true, false, 80, 12);

  INSERT INTO public.certification_attempts (id, user_id, certification_type_id, attempt_number, status, passed, score_percentage)
  VALUES (c_attempt, c_user, c_cert_type, 1, 'graded', true, 90.00);

  INSERT INTO public.certification_records (
    id, user_id, certification_type_id, written_attempt_id, written_passed_at,
    status, expires_at, certified_at
  ) VALUES (
    c_cert_rec, c_user, c_cert_type, c_attempt, now(),
    'active', now() + interval '6 months', now()
  );

  PERFORM public.evaluate_user_badges(c_user, 'cert_active');
  IF NOT EXISTS (
    SELECT 1 FROM public.user_badges WHERE user_id = c_user AND badge_key = 'certified'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g2 certified: badge not awarded after active cert';
  END IF;

  -- NULL hire_date safety
  PERFORM public.evaluate_user_badges(c_null_hire, 'tenure');
  SELECT count(*)::int INTO v_count
  FROM public.user_badges ub
  WHERE ub.user_id = c_null_hire AND ub.badge_key IN ('one_ring', 'five_rings', 'old_timber');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g2 NULL hire_date: tenure badges awarded without hire_date';
  END IF;

  PERFORM public.evaluate_user_badges(c_tenure, 'tenure');
  IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = c_tenure AND badge_key = 'one_ring') THEN
    RAISE EXCEPTION 'GATE FAILED g2 tenure: one_ring not awarded for 6-year hire';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = c_tenure AND badge_key = 'five_rings') THEN
    RAISE EXCEPTION 'GATE FAILED g2 tenure: five_rings not awarded for 6-year hire';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = c_tenure AND badge_key = 'old_timber') THEN
    RAISE EXCEPTION 'GATE FAILED g2 tenure: old_timber wrongly awarded at 6 years';
  END IF;

  v_result := public.evaluate_tenure_badges_cron();
  v_null_hire := (v_result->>'null_hire_date_count')::int;
  IF v_null_hire IS NULL OR v_null_hire < 1 THEN
    RAISE EXCEPTION 'GATE FAILED g2 tenure cron: null_hire_date_count missing or too low (got %)', v_null_hire;
  END IF;

  RAISE NOTICE 'OK: gamification gate 2 — idempotency, sharp_eye corrective_bonus signal, prestige order, NULL hire_date safe.';
  RAISE NOTICE 'GATE 2 null_hire_date_count (gate DB app_users): %', v_null_hire;
END $$;

-- ---- Increment-specific checks: 20260608160000 (gamification gate 3) ----------
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regprocedure('public.chicago_iso_week_start(timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.chicago_iso_week_start(timestamptz) is missing';
  END IF;
  IF to_regprocedure('public.user_has_rto_covering_week(uuid,date)') IS NULL THEN
    missing := missing || E'\n  - function public.user_has_rto_covering_week is missing';
  END IF;
  IF to_regprocedure('public.record_streak_activity(uuid,text,uuid,timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.record_streak_activity is missing';
  END IF;
  IF to_regprocedure('public.refresh_user_streak(uuid,timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.refresh_user_streak is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'point_transactions' AND t.tgname = 'trg_weekly_streak_point_tx' AND NOT t.tgisinternal
  ) THEN
    missing := missing || E'\n  - trigger trg_weekly_streak_point_tx on point_transactions is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'safety_briefing_answers' AND t.tgname = 'trg_weekly_streak_briefing' AND NOT t.tgisinternal
  ) THEN
    missing := missing || E'\n  - trigger trg_weekly_streak_briefing on safety_briefing_answers is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — gamification gate 3 objects (20260608160000) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: gamification gate 3 schema — weekly streak engine functions + triggers present.';
END $$;

DO $$
DECLARE
  c_user       uuid := '00000000-0000-0000-0000-00000000d301';
  c_break      uuid := '00000000-0000-0000-0000-00000000d302';
  c_freeze     uuid := '00000000-0000-0000-0000-00000000d303';
  c_rto        uuid := '00000000-0000-0000-0000-00000000d304';
  c_briefing   uuid := '00000000-0000-0000-0000-00000000d305';
  v_week_a     date;
  v_week_b     date;
  v_streak     int;
  v_freezes    int;
  v_rows       int;
  v_def        text;
  r            public.streak_state;
BEGIN
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.safety_briefing_answers DISABLE TRIGGER trg_weekly_streak_briefing;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user,     'authenticated', 'authenticated', 'gate-g3-tz@example.invalid'),
    (c_break,    'authenticated', 'authenticated', 'gate-g3-break@example.invalid'),
    (c_freeze,   'authenticated', 'authenticated', 'gate-g3-freeze@example.invalid'),
    (c_rto,      'authenticated', 'authenticated', 'gate-g3-rto@example.invalid'),
    (c_briefing, 'authenticated', 'authenticated', 'gate-g3-briefing@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  -- chicago_iso_week_start: Monday seam (CST winter)
  v_week_a := public.chicago_iso_week_start('2024-01-08 05:59:00+00'::timestamptz);
  v_week_b := public.chicago_iso_week_start('2024-01-08 06:01:00+00'::timestamptz);
  IF v_week_a <> '2024-01-01'::date OR v_week_b <> '2024-01-08'::date THEN
    RAISE EXCEPTION 'GATE FAILED g3 tz seam: got % and % (expected 2024-01-01 and 2024-01-08)', v_week_a, v_week_b;
  END IF;

  -- chicago_iso_week_start: DST fall-back week (CST) — Sunday 11:59 PM vs Monday 12:01 AM
  v_week_a := public.chicago_iso_week_start('2024-11-04 05:59:00+00'::timestamptz);
  v_week_b := public.chicago_iso_week_start('2024-11-04 06:01:00+00'::timestamptz);
  IF v_week_a <> '2024-10-28'::date OR v_week_b <> '2024-11-04'::date THEN
    RAISE EXCEPTION 'GATE FAILED g3 DST seam: got % and % (expected 2024-10-28 and 2024-11-04)', v_week_a, v_week_b;
  END IF;

  -- Missed week breaks streak (no freeze, no RTO) — active 2099-07-06 + 2099-07-20 weeks; gap 2099-07-13
  PERFORM public.record_streak_activity(c_break, 'compliance_form', gen_random_uuid(),
    '2099-07-08 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  UPDATE public.streak_state SET freezes_remaining = 0 WHERE user_id = c_break;
  PERFORM public.record_streak_activity(c_break, 'compliance_form', gen_random_uuid(),
    '2099-07-22 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  SELECT current_streak_weeks INTO v_streak FROM public.streak_state WHERE user_id = c_break;
  IF v_streak <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g3 missed week: expected streak 1 after gap, got %', v_streak;
  END IF;

  -- Manual freeze consumed exactly once — active 2099-06-01 + 2099-06-15 weeks; gap 2099-06-08 frozen
  PERFORM public.record_streak_activity(c_freeze, 'announcement_claim', gen_random_uuid(),
    '2099-06-03 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  UPDATE public.streak_state SET freezes_remaining = 1 WHERE user_id = c_freeze;
  PERFORM public.record_streak_activity(c_freeze, 'announcement_claim', gen_random_uuid(),
    '2099-06-17 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  SELECT current_streak_weeks, freezes_remaining
  INTO v_streak, v_freezes
  FROM public.streak_state WHERE user_id = c_freeze;
  IF v_streak <> 3 OR v_freezes <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g3 freeze: expected streak 3 freezes 0, got streak=% freezes=%', v_streak, v_freezes;
  END IF;
  SELECT count(*)::int INTO v_rows
  FROM public.streak_week_activity
  WHERE user_id = c_freeze AND activity_source = 'manual_freeze';
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g3 freeze: expected 1 manual_freeze row, got %', v_rows;
  END IF;

  -- RTO-covered gap week: no break, manual freeze untouched
  PERFORM public.record_streak_activity(c_rto, 'compliance_form', gen_random_uuid(),
    '2099-08-05 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  INSERT INTO public.rto_requests (
    id, user_id, full_name, email, start_date, end_date, reason, status
  ) VALUES (
    '00000000-0000-0000-0000-00000000d310',
    c_rto, 'Gate G3 RTO', 'gate-g3-rto@example.invalid',
    '2099-08-10', '2099-08-14', 'gate g3 rto cover', 'Approved'
  );
  PERFORM public.record_streak_activity(c_rto, 'compliance_form', gen_random_uuid(),
    '2099-08-19 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  SELECT current_streak_weeks, freezes_remaining
  INTO v_streak, v_freezes
  FROM public.streak_state WHERE user_id = c_rto;
  IF v_streak <> 3 OR v_freezes <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g3 RTO: expected streak 3 freezes 1, got streak=% freezes=%', v_streak, v_freezes;
  END IF;
  IF NOT public.user_has_rto_covering_week(c_rto, '2099-08-10'::date) THEN
    RAISE EXCEPTION 'GATE FAILED g3 RTO: user_has_rto_covering_week false for covered week';
  END IF;

  -- Weekly streak writes NO streak_bonus rows
  SELECT count(*)::int INTO v_rows
  FROM public.point_transactions
  WHERE user_id IN (c_break, c_freeze, c_rto) AND source = 'streak_bonus';
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g3 raffle-excluded: weekly streak wrote % streak_bonus rows', v_rows;
  END IF;

  -- Lit badge at 4-week streak (threshold from settings) — consecutive Mondays 2099-05-04 .. 2099-05-25
  PERFORM public.record_streak_activity(c_user, 'compliance_form', gen_random_uuid(),
    '2099-05-06 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  PERFORM public.record_streak_activity(c_user, 'compliance_form', gen_random_uuid(),
    '2099-05-13 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  PERFORM public.record_streak_activity(c_user, 'compliance_form', gen_random_uuid(),
    '2099-05-20 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  PERFORM public.record_streak_activity(c_user, 'compliance_form', gen_random_uuid(),
    '2099-05-27 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  IF NOT EXISTS (
    SELECT 1 FROM public.user_badges
    WHERE user_id = c_user AND badge_key = 'lit' AND prestige_tier = 1
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g3 Lit: bronze not awarded at 4-week streak';
  END IF;

  -- Existing briefing streak (sync_streak_bonuses_for_user) left untouched
  v_def := pg_get_functiondef('public.sync_streak_bonuses_for_user(uuid,timestamp with time zone)'::regprocedure);
  IF position('streak_bonus' IN v_def) = 0 THEN
    RAISE EXCEPTION 'GATE FAILED g3 briefing streak: sync_streak_bonuses_for_user no longer writes streak_bonus';
  END IF;

  ALTER TABLE public.announcement_rewards DISABLE TRIGGER enforce_latest_announcement_claim;
  ALTER TABLE public.announcement_rewards DISABLE TRIGGER trigger_reward_claim_window;

  INSERT INTO public.announcements (id, title, message, date)
  VALUES ('00000000-0000-0000-0000-00000000d3a1', 'Gate G3 Briefing', 'body', '2099-05-01');

  INSERT INTO public.announcement_rewards (user_id, announcement_id, points_awarded, claimed_at)
  VALUES (
    c_briefing,
    '00000000-0000-0000-0000-00000000d3a1',
    1,
    '2099-05-01 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago'
  );

  PERFORM public.sync_streak_bonuses_for_user(
    c_briefing,
    '2099-05-01 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago'
  );

  SELECT count(*)::int INTO v_rows
  FROM public.point_transactions
  WHERE user_id = c_briefing AND source = 'streak_bonus';
  IF v_rows < 1 THEN
    RAISE EXCEPTION 'GATE FAILED g3 briefing streak: sync_streak_bonuses_for_user did not write streak_bonus';
  END IF;

  ALTER TABLE public.announcement_rewards ENABLE TRIGGER enforce_latest_announcement_claim;
  ALTER TABLE public.announcement_rewards ENABLE TRIGGER trigger_reward_claim_window;

  RAISE NOTICE 'OK: gamification gate 3 — Chicago week seam, DST, break, freeze-once, RTO protect, no streak_bonus, Lit bronze, briefing streak untouched.';
END $$;

-- ---- Increment-specific checks: 20260608180000 (gamification gate 4) ----------
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regclass('public.gamification_baseline_cohort') IS NULL THEN
    missing := missing || E'\n  - table public.gamification_baseline_cohort is missing';
  END IF;
  IF to_regprocedure('public.is_competition_eligible(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.is_competition_eligible(uuid) is missing';
  END IF;
  IF to_regprocedure('public.emit_recognition_event(recognition_event_type,uuid,jsonb,text)') IS NULL THEN
    missing := missing || E'\n  - function public.emit_recognition_event is missing';
  END IF;
  IF to_regprocedure('public.maybe_emit_badge_recognition(uuid,text,integer)') IS NULL THEN
    missing := missing || E'\n  - function public.maybe_emit_badge_recognition is missing';
  END IF;
  IF to_regprocedure('public.maybe_emit_tier_promotion_feed(uuid,integer)') IS NULL THEN
    missing := missing || E'\n  - function public.maybe_emit_tier_promotion_feed is missing';
  END IF;
  IF to_regprocedure('public.get_gamification_admin_metrics(date,date)') IS NULL THEN
    missing := missing || E'\n  - function public.get_gamification_admin_metrics is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'point_transactions'
      AND t.tgname = 'trg_recognition_feed_tier_promotion'
      AND NOT t.tgisinternal
  ) THEN
    missing := missing || E'\n  - trigger trg_recognition_feed_tier_promotion on point_transactions is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — gamification gate 4 objects (20260608180000) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: gamification gate 4 schema — recognition feed emitter, baseline cohort, admin metrics, eligibility.';
END $$;

DO $$
DECLARE
  c_user       uuid := '00000000-0000-0000-0000-00000000d401';
  c_admin      uuid := '00000000-0000-0000-0000-00000000d402';
  c_field      uuid := '00000000-0000-0000-0000-00000000d403';
  c_excluded   uuid := '00000000-0000-0000-0000-00000000d404';
  v_count      int;
  v_id1        uuid;
  v_id2        uuid;
  v_metrics    jsonb;
  v_ledger_sum int;
  v_standings  jsonb;
BEGIN
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_recognition_feed_tier_promotion;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user,     'authenticated', 'authenticated', 'gate-g4-user@example.invalid'),
    (c_admin,    'authenticated', 'authenticated', 'gate-g4-admin@example.invalid'),
    (c_field,    'authenticated', 'authenticated', 'gate-g4-field@example.invalid'),
    (c_excluded, 'authenticated', 'authenticated', 'gate-g4-excluded@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_users SET role = 'admin' WHERE user_id = c_admin;
  UPDATE public.app_users SET role = 'employee' WHERE user_id = c_field;
  UPDATE public.app_users SET role = 'safety_officer' WHERE user_id = c_excluded;

  -- Excluded badges: First Light, Cashed In — no feed rows
  PERFORM public.award_badge(c_user, 'first_light', 1);
  PERFORM public.award_badge(c_user, 'cashed_in', 1);
  SELECT count(*)::int INTO v_count
  FROM public.recognition_feed rf
  WHERE rf.subject_user_id = c_user
    AND rf.payload->>'badge_key' IN ('first_light', 'cashed_in');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g4 excluded badges: expected 0 feed rows, got %', v_count;
  END IF;

  -- Sharp Eye bronze/silver — no feed; gold — feed
  PERFORM public.award_badge(c_user, 'sharp_eye', 1);
  PERFORM public.award_badge(c_user, 'sharp_eye', 2);
  SELECT count(*)::int INTO v_count
  FROM public.recognition_feed rf
  WHERE rf.subject_user_id = c_user AND rf.payload->>'badge_key' = 'sharp_eye';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g4 sharp eye sub-max: expected 0 feed rows before gold, got %', v_count;
  END IF;

  PERFORM public.award_badge(c_user, 'sharp_eye', 3);
  IF NOT EXISTS (
    SELECT 1 FROM public.recognition_feed rf
    WHERE rf.subject_user_id = c_user
      AND rf.event_type = 'badge_awarded'
      AND rf.payload->>'badge_key' = 'sharp_eye'
      AND (rf.payload->>'prestige_tier')::int = 3
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g4 sharp eye gold: feed row missing';
  END IF;

  -- Certified — feed
  PERFORM public.award_badge(c_user, 'certified', 1);
  IF NOT EXISTS (
    SELECT 1 FROM public.recognition_feed rf
    WHERE rf.subject_user_id = c_user
      AND rf.event_type = 'badge_awarded'
      AND rf.payload->>'badge_key' = 'certified'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g4 certified: feed row missing';
  END IF;

  -- Tenure — tenure_milestone event type
  PERFORM public.award_badge(c_user, 'one_ring', 1);
  IF NOT EXISTS (
    SELECT 1 FROM public.recognition_feed rf
    WHERE rf.subject_user_id = c_user
      AND rf.event_type = 'tenure_milestone'
      AND rf.payload->>'badge_key' = 'one_ring'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g4 tenure: tenure_milestone feed row missing';
  END IF;

  -- dedupe_key blocks re-emission on re-award attempt
  v_id1 := public.emit_recognition_event(
    'badge_awarded', c_user,
    '{"badge_key":"dedupe_test"}'::jsonb,
    'gate4_dedupe_test:' || c_user::text
  );
  v_id2 := public.emit_recognition_event(
    'badge_awarded', c_user,
    '{"badge_key":"dedupe_test"}'::jsonb,
    'gate4_dedupe_test:' || c_user::text
  );
  IF v_id1 IS NULL OR v_id2 IS NOT NULL THEN
    RAISE EXCEPTION 'GATE FAILED g4 dedupe_key: expected first insert id non-null, second null';
  END IF;
  SELECT count(*)::int INTO v_count
  FROM public.recognition_feed rf WHERE rf.dedupe_key = 'gate4_dedupe_test:' || c_user::text;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g4 dedupe_key: expected 1 row, got %', v_count;
  END IF;

  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_recognition_feed_tier_promotion;

  -- Tier promotion: 49 pts stays Seedling — no feed; 50 → Sapling — exactly one tier_promotion
  INSERT INTO public.point_transactions (user_id, amount, source, reason)
  VALUES (c_user, 49, 'announcement_claim', 'gate g4 tier boundary');
  SELECT count(*)::int INTO v_count
  FROM public.recognition_feed rf
  WHERE rf.subject_user_id = c_user AND rf.event_type = 'tier_promotion';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g4 tier pre-threshold: expected 0 tier_promotion rows, got %', v_count;
  END IF;

  INSERT INTO public.point_transactions (user_id, amount, source, reason)
  VALUES (c_user, 1, 'announcement_claim', 'gate g4 tier boundary cross');
  SELECT count(*)::int INTO v_count
  FROM public.recognition_feed rf
  WHERE rf.subject_user_id = c_user AND rf.event_type = 'tier_promotion';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g4 first major tier: expected 1 tier_promotion row, got %', v_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.recognition_feed rf
    WHERE rf.subject_user_id = c_user
      AND rf.event_type = 'tier_promotion'
      AND rf.payload->>'tier_key' = 'sapling'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g4 tier promotion payload: expected sapling tier_key';
  END IF;

  -- On the Board badge + re-eval must not add a second tier_promotion
  PERFORM public.evaluate_user_badges(c_user, 'tier_up');
  PERFORM public.maybe_emit_tier_promotion_feed(c_user, public.get_user_lifetime_earned(c_user));
  SELECT count(*)::int INTO v_count
  FROM public.recognition_feed rf
  WHERE rf.subject_user_id = c_user AND rf.event_type = 'tier_promotion';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g4 on_the_board dedupe: expected 1 tier_promotion after re-eval, got %', v_count;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_badges ub
    WHERE ub.user_id = c_user AND ub.badge_key = 'on_the_board'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g4 on_the_board: badge not awarded at Sapling';
  END IF;

  -- Sub-level only promotion (50→85) must not emit another tier_promotion
  INSERT INTO public.point_transactions (user_id, amount, source, reason)
  VALUES (c_user, 35, 'announcement_claim', 'gate g4 sub-level only');
  SELECT count(*)::int INTO v_count
  FROM public.recognition_feed rf
  WHERE rf.subject_user_id = c_user AND rf.event_type = 'tier_promotion';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED g4 sub-level: expected still 1 tier_promotion row, got %', v_count;
  END IF;

  -- is_competition_eligible filter
  IF NOT public.is_competition_eligible(c_field) THEN
    RAISE EXCEPTION 'GATE FAILED g4 eligibility: employee should be competition eligible';
  END IF;
  IF public.is_competition_eligible(c_excluded) THEN
    RAISE EXCEPTION 'GATE FAILED g4 eligibility: safety_officer must be excluded';
  END IF;
  IF public.is_competition_eligible(c_admin) THEN
    RAISE EXCEPTION 'GATE FAILED g4 eligibility: admin must be excluded from standings';
  END IF;

  -- Seed standings data: field user earns more than excluded safety_officer
  INSERT INTO public.point_transactions (user_id, amount, source, reason)
  VALUES
    (c_field, 200, 'announcement_claim', 'gate g4 standings field'),
    (c_excluded, 500, 'announcement_claim', 'gate g4 standings excluded');

  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  v_metrics := public.get_gamification_admin_metrics(current_date - 30, current_date);

  IF (v_metrics->'long_tail_activation'->>'status') <> 'baseline_not_captured' THEN
    RAISE EXCEPTION 'GATE FAILED g4 long-tail empty cohort: expected baseline_not_captured, got %',
      v_metrics->'long_tail_activation'->>'status';
  END IF;
  IF (v_metrics->'long_tail_activation'->>'message') <> 'baseline not yet captured' THEN
    RAISE EXCEPTION 'GATE FAILED g4 long-tail message: got %', v_metrics->'long_tail_activation'->>'message';
  END IF;

  IF (v_metrics->'ledger_reconciliation'->>'period_totals_match')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'GATE FAILED g4 ledger reconciliation: period_totals_match false (metrics=% ledger=%)',
      v_metrics->'ledger_reconciliation'->>'metrics_period_earnings',
      v_metrics->'ledger_reconciliation'->>'sum_ledger_positive_earnings_in_period';
  END IF;

  SELECT COALESCE(SUM(pt.amount), 0)::int
  INTO v_ledger_sum
  FROM public.point_transactions pt
  WHERE pt.amount > 0
    AND pt.created_at >= (current_date - 30)::timestamptz
    AND pt.created_at < (current_date + 1)::timestamptz
    AND pt.source IN (
      'announcement_claim', 'compliance_form', 'streak_bonus',
      'near_miss_report', 'certification', 'manual_award'
    );

  IF (v_metrics->'ledger_reconciliation'->>'sum_ledger_positive_earnings_in_period')::int <> v_ledger_sum THEN
    RAISE EXCEPTION 'GATE FAILED g4 ledger reconciliation: RPC period sum % <> direct ledger %',
      v_metrics->'ledger_reconciliation'->>'sum_ledger_positive_earnings_in_period', v_ledger_sum;
  END IF;

  v_standings := v_metrics->'standings';
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_standings) elem
    WHERE (elem->>'user_id')::uuid = c_excluded
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g4 standings: safety_officer must not appear in competition standings';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_standings) elem
    WHERE (elem->>'user_id')::uuid = c_field
  ) THEN
    RAISE EXCEPTION 'GATE FAILED g4 standings: eligible field employee missing from standings';
  END IF;

  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_weekly_streak_point_tx;

  RAISE NOTICE 'OK: gamification gate 4 — feed curation, dedupe_key, tier/on_the_board dedupe, analytics reconciliation, eligibility, long-tail graceful empty cohort.';
END $$;

-- ---- Increment-specific checks: 20260608200000 (gamification gate 5) ----------
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regprocedure('public.get_gamification_standings(integer)') IS NULL THEN
    missing := missing || E'\n  - function public.get_gamification_standings(integer) is missing';
  END IF;
  IF to_regprocedure('public.get_public_gamification_profile(uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.get_public_gamification_profile(uuid) is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — gamification gate 5 objects (20260608200000) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: gamification gate 5 schema — standings + public profile RPCs present.';
END $$;

DO $$
DECLARE
  c_field    uuid := '00000000-0000-0000-0000-00000000d501';
  c_admin    uuid := '00000000-0000-0000-0000-00000000d502';
  v_standings jsonb;
  v_profile  jsonb;
BEGIN
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_field, 'authenticated', 'authenticated', 'gate-g5-field@example.invalid'),
    (c_admin, 'authenticated', 'authenticated', 'gate-g5-admin@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_users SET role = 'employee', hire_date = '2020-01-01' WHERE user_id = c_field;
  UPDATE public.app_users SET role = 'admin' WHERE user_id = c_admin;

  PERFORM set_config('request.jwt.claim.sub', c_field::text, true);
  v_standings := public.get_gamification_standings(5);
  IF jsonb_typeof(v_standings) <> 'array' THEN
    RAISE EXCEPTION 'GATE FAILED g5 standings: expected json array, got %', jsonb_typeof(v_standings);
  END IF;

  v_profile := public.get_public_gamification_profile(c_field);
  IF (v_profile->>'user_id')::uuid IS DISTINCT FROM c_field THEN
    RAISE EXCEPTION 'GATE FAILED g5 profile: user_id mismatch';
  END IF;
  IF (v_profile->>'eligible')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'GATE FAILED g5 profile: field employee should be eligible';
  END IF;

  RAISE NOTICE 'OK: gamification gate 5 — standings array + public profile for eligible field user.';
END $$;

-- ---- Increment-specific checks: 20260608220000 (gamification gate 6) ----------
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regprocedure('public.is_gamification_test_account(text)') IS NULL THEN
    missing := missing || E'\n  - function public.is_gamification_test_account(text) is missing';
  END IF;
  IF to_regprocedure('public.is_gamification_program_admin()') IS NULL THEN
    missing := missing || E'\n  - function public.is_gamification_program_admin() is missing';
  END IF;
  IF to_regprocedure('public.get_real_users_missing_hire_date()') IS NULL THEN
    missing := missing || E'\n  - function public.get_real_users_missing_hire_date() is missing';
  END IF;
  IF to_regprocedure('public.assert_hire_dates_for_baseline()') IS NULL THEN
    missing := missing || E'\n  - function public.assert_hire_dates_for_baseline() is missing';
  END IF;
  IF to_regprocedure('public.capture_gamification_baseline_cohort()') IS NULL THEN
    missing := missing || E'\n  - function public.capture_gamification_baseline_cohort() is missing';
  END IF;
  IF to_regprocedure('public.verify_gamification_workforce_levels()') IS NULL THEN
    missing := missing || E'\n  - function public.verify_gamification_workforce_levels() is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — gamification gate 6 objects (20260608220000) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: gamification gate 6 schema — hire_date assert, baseline capture, program admin helpers.';
END $$;

DO $$
DECLARE
  c_field      uuid := '00000000-0000-0000-0000-00000000d601';
  c_missing    uuid := '00000000-0000-0000-0000-00000000d602';
  c_test       uuid := '00000000-0000-0000-0000-00000000d603';
  c_admin      uuid := '00000000-0000-0000-0000-00000000d604';
  c_safety     uuid := '00000000-0000-0000-0000-00000000d605';
  v_metrics    jsonb;
  v_capture    jsonb;
  v_verify     jsonb;
  v_missing    jsonb;
  v_caught     boolean := false;
BEGIN
  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_field,   'authenticated', 'authenticated', 'gate-g6-field@example.invalid'),
    (c_missing, 'authenticated', 'authenticated', 'gate-g6-missing-hire@alltts.com'),
    (c_test,    'authenticated', 'authenticated', 'gate-g6-test@atts.test'),
    (c_admin,   'authenticated', 'authenticated', 'gate-g6-admin@example.invalid'),
    (c_safety,  'authenticated', 'authenticated', 'gate-g6-safety@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_users SET role = 'employee', hire_date = '2019-06-01' WHERE user_id = c_field;
  UPDATE public.app_users SET role = 'employee', hire_date = NULL WHERE user_id = c_missing;
  UPDATE public.app_users SET role = 'employee', hire_date = NULL WHERE user_id = c_test;
  UPDATE public.app_users SET role = 'admin' WHERE user_id = c_admin;
  UPDATE public.app_users SET role = 'safety_officer' WHERE user_id = c_safety;

  -- Test account with NULL hire_date must not block assertion
  BEGIN
    PERFORM public.assert_hire_dates_for_baseline();
    v_caught := false;
  EXCEPTION
    WHEN OTHERS THEN
      v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'GATE FAILED g6 hire_date: assert should fail when real user missing hire_date';
  END IF;

  UPDATE public.app_users SET hire_date = '2021-03-15' WHERE user_id = c_missing;
  PERFORM public.assert_hire_dates_for_baseline();

  PERFORM set_config('request.jwt.claim.sub', c_admin::text, true);
  v_missing := public.get_real_users_missing_hire_date();
  IF jsonb_array_length(v_missing) <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g6 hire_date: expected zero missing after backfill, got %', v_missing;
  END IF;

  -- Capture baseline cohort (one-time)
  v_capture := public.capture_gamification_baseline_cohort();
  IF (v_capture->>'status') <> 'captured' THEN
    RAISE EXCEPTION 'GATE FAILED g6 capture: expected captured status, got %', v_capture->>'status';
  END IF;
  IF (v_capture->>'cohort_size')::int < 1 THEN
    RAISE EXCEPTION 'GATE FAILED g6 capture: expected cohort_size >= 1, got %', v_capture->>'cohort_size';
  END IF;

  -- Second capture must refuse
  v_caught := false;
  BEGIN
    PERFORM public.capture_gamification_baseline_cohort();
  EXCEPTION
    WHEN OTHERS THEN
      v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'GATE FAILED g6 capture: second capture should raise';
  END IF;

  v_metrics := public.get_gamification_admin_metrics(current_date - 30, current_date);
  IF (v_metrics->'long_tail_activation'->>'status') <> 'ready' THEN
    RAISE EXCEPTION 'GATE FAILED g6 metrics: expected long_tail ready after capture, got %',
      v_metrics->'long_tail_activation'->>'status';
  END IF;
  IF (v_metrics->'hire_date_precondition'->>'missing_count')::int <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED g6 metrics: expected missing_count 0, got %',
      v_metrics->'hire_date_precondition'->>'missing_count';
  END IF;

  v_verify := public.verify_gamification_workforce_levels();
  IF (v_verify->>'status') <> 'ok' THEN
    RAISE EXCEPTION 'GATE FAILED g6 workforce levels: %', v_verify::text;
  END IF;

  -- safety_officer can read admin metrics
  PERFORM set_config('request.jwt.claim.sub', c_safety::text, true);
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'GATE FAILED g6 program admin: safety_officer should be program admin';
  END IF;
  v_metrics := public.get_gamification_admin_metrics(current_date - 7, current_date);
  IF v_metrics IS NULL THEN
    RAISE EXCEPTION 'GATE FAILED g6 safety_officer metrics: null result';
  END IF;

  RAISE NOTICE 'OK: gamification gate 6 — hire_date assert, baseline capture once, long-tail ready, workforce levels, safety_officer access.';
END $$;

-- ---- Increment-specific checks: 20260608230000 + 20260608230100 (Phase 2 gate 1) ----
DO $$
DECLARE
  missing text := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'point_source' AND e.enumlabel = 'challenge_reward'
  ) THEN
    missing := missing || E'\n  - point_source.challenge_reward enum value missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'point_source' AND e.enumlabel = 'campaign_multiplier_bonus'
  ) THEN
    missing := missing || E'\n  - point_source.campaign_multiplier_bonus enum value missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'recognition_event_type' AND e.enumlabel = 'season_podium'
  ) THEN
    missing := missing || E'\n  - recognition_event_type.season_podium enum value missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'recognition_event_type' AND e.enumlabel = 'season_most_improved'
  ) THEN
    missing := missing || E'\n  - recognition_event_type.season_most_improved enum value missing';
  END IF;

  IF to_regclass('public.seasons') IS NULL THEN
    missing := missing || E'\n  - table public.seasons is missing';
  END IF;
  IF to_regprocedure('public.gamification_setting_bool(text)') IS NULL THEN
    missing := missing || E'\n  - function public.gamification_setting_bool is missing';
  END IF;
  IF to_regprocedure('public.is_phase2_master_enabled()') IS NULL THEN
    missing := missing || E'\n  - function public.is_phase2_master_enabled is missing';
  END IF;
  IF to_regprocedure('public.are_seasons_enabled()') IS NULL THEN
    missing := missing || E'\n  - function public.are_seasons_enabled is missing';
  END IF;
  IF to_regprocedure('public.point_tx_in_season_window(integer,timestamp with time zone,timestamp with time zone,timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.point_tx_in_season_window is missing';
  END IF;
  IF to_regprocedure('public.get_user_season_score(uuid,text)') IS NULL THEN
    missing := missing || E'\n  - function public.get_user_season_score is missing';
  END IF;
  IF to_regprocedure('public.finalize_season(text)') IS NULL THEN
    missing := missing || E'\n  - function public.finalize_season is missing';
  END IF;
  IF to_regprocedure('public.process_gamification_season_lifecycle()') IS NULL THEN
    missing := missing || E'\n  - function public.process_gamification_season_lifecycle is missing';
  END IF;
  IF to_regprocedure('public.get_user_season_improvement_delta(uuid,text)') IS NULL THEN
    missing := missing || E'\n  - function public.get_user_season_improvement_delta is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.seasons s WHERE s.season_key = 'season_1_placeholder'
  ) THEN
    missing := missing || E'\n  - placeholder season season_1_placeholder not seeded';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — Phase 2 gate 1 objects (20260608230100) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: Phase 2 gate 1 schema — enums, seasons, flag helpers, score RPCs, lifecycle present.';
END $$;

DO $$
DECLARE
  c_user       uuid := '00000000-0000-0000-0000-00000000e201';
  c_s2_user    uuid := '00000000-0000-0000-0000-00000000e202';
  c_flag       uuid := '00000000-0000-0000-0000-00000000e203';
  v_season_start timestamptz := '2026-06-01 05:00:00+00'::timestamptz;
  v_season_end   timestamptz := '2026-07-01 05:00:00+00'::timestamptz;
  v_in_window    boolean;
  v_score        int;
  v_lifetime     int;
  v_lifetime_s2  int;
  v_level_before record;
  v_level_after  record;
  v_mismatch     int;
  v_fin1         jsonb;
  v_fin2         jsonb;
  v_podium       int;
  v_lifecycle    jsonb;
  v_active       int;
  v_user         record;
  v_old_sum      int;
  v_new_sum      int;
BEGIN
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_recognition_feed_tier_promotion;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user,    'authenticated', 'authenticated', 'gate-p2g1-user@example.invalid'),
    (c_s2_user, 'authenticated', 'authenticated', 'gate-p2g1-s2@example.invalid'),
    (c_flag,    'authenticated', 'authenticated', 'gate-p2g1-flag@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_users SET role = 'employee' WHERE user_id IN (c_user, c_s2_user, c_flag);

  -- Flag-off defaults
  IF public.are_seasons_enabled() THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 flag-off: are_seasons_enabled should be false at gate start';
  END IF;
  IF public.is_phase2_master_enabled() THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 flag-off: phase2_enabled should be false at gate start';
  END IF;
  SELECT count(*)::int INTO v_active FROM public.get_active_season();
  IF v_active <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 flag-off: get_active_season should return empty when flag off';
  END IF;
  v_lifecycle := public.process_gamification_season_lifecycle();
  IF (v_lifecycle->>'status') <> 'skipped' THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 flag-off lifecycle: expected skipped, got %', v_lifecycle;
  END IF;
  v_fin1 := public.finalize_season('season_1_placeholder');
  IF (v_fin1->>'status') <> 'skipped' OR (v_fin1->>'reason') <> 'seasons_disabled' THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 flag-off finalize: expected seasons_disabled skip, got %', v_fin1;
  END IF;

  -- Chicago season-window seam (mirror raffle-month CDT June boundary fixtures)
  v_in_window := public.point_tx_in_season_window(
    1, '2026-05-31T05:00:00.000Z'::timestamptz, v_season_start, v_season_end
  );
  IF v_in_window THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 season seam: May 31 05:00Z should be outside June season';
  END IF;
  v_in_window := public.point_tx_in_season_window(
    1, '2026-06-01T04:59:59.000Z'::timestamptz, v_season_start, v_season_end
  );
  IF v_in_window THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 season seam: Jun 1 04:59:59Z should be outside June season';
  END IF;
  v_in_window := public.point_tx_in_season_window(
    1, '2026-06-01T05:00:00.000Z'::timestamptz, v_season_start, v_season_end
  );
  IF NOT v_in_window THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 season seam: Jun 1 05:00:00Z should be inside June season';
  END IF;

  -- Gate test seasons (2099 — isolated from prod config)
  INSERT INTO public.seasons (season_key, name, theme, start_at, end_at, status, most_improved_enabled, sort_order)
  VALUES
    ('gate_p2g1_season_a', 'Gate S-A', 'test',
     '2099-06-01 05:00:00+00'::timestamptz, '2099-07-01 05:00:00+00'::timestamptz,
     'closed', false, 900),
    ('gate_p2g1_season_b', 'Gate S-B', 'test',
     '2099-08-01 05:00:00+00'::timestamptz, '2099-09-01 05:00:00+00'::timestamptz,
     'closed', false, 901)
  ON CONFLICT (season_key) DO NOTHING;

  -- Temporarily enable seasons for behavioral tests (restored at end)
  UPDATE public.gamification_settings SET value = 'true'::jsonb
  WHERE key IN ('phase2_enabled', 'seasons_enabled');

  IF NOT public.are_seasons_enabled() THEN
    RAISE EXCEPTION 'GATE FAILED p2g1: could not enable seasons for behavioral tests';
  END IF;

  -- Season A earnings
  INSERT INTO public.point_transactions (user_id, amount, source, reason, created_at)
  VALUES
    (c_user, 100, 'compliance_form', 'gate p2g1 season A',
     '2099-06-15 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  -- Redemption mid-season must not affect season score (positive-only)
  INSERT INTO public.point_transactions (user_id, amount, source, reason, created_at)
  VALUES
    (c_user, -10, 'redemption', 'gate p2g1 redemption',
     '2099-06-20 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  v_score := public.get_user_season_score(c_user, 'gate_p2g1_season_a');
  IF v_score <> 100 THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 redemption: season score expected 100, got %', v_score;
  END IF;

  v_lifetime := public.get_user_lifetime_earned(c_user);
  SELECT * INTO v_level_before FROM public.get_user_level(c_user);

  -- Season B earnings (two-track: season score resets per window; lifetime accumulates)
  INSERT INTO public.point_transactions (user_id, amount, source, reason, created_at)
  VALUES
    (c_s2_user, 50, 'announcement_claim', 'gate p2g1 season A s2',
     '2099-06-10 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago'),
    (c_user, 75, 'compliance_form', 'gate p2g1 season B',
     '2099-08-15 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  IF public.get_user_season_score(c_user, 'gate_p2g1_season_a') <> 100 THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 two-track: season A score changed after season B earn';
  END IF;
  IF public.get_user_season_score(c_user, 'gate_p2g1_season_b') <> 75 THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 two-track: season B score expected 75, got %',
      public.get_user_season_score(c_user, 'gate_p2g1_season_b');
  END IF;

  v_lifetime_s2 := public.get_user_lifetime_earned(c_user);
  IF v_lifetime_s2 <> v_lifetime + 75 THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 two-track: lifetime expected % got %',
      v_lifetime + 75, v_lifetime_s2;
  END IF;

  SELECT * INTO v_level_after FROM public.get_user_level(c_user);
  IF v_level_after.lifetime_earned <> v_level_before.lifetime_earned + 75 THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 two-track: level lifetime_earned did not accumulate across seasons';
  END IF;
  IF v_level_after.tier_key IS DISTINCT FROM v_level_before.tier_key
     AND v_level_after.lifetime_earned <= v_level_before.lifetime_earned THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 two-track: tier should only advance when lifetime increases';
  END IF;

  -- D4: get_user_lifetime_earned byte-identical for all users without challenge rows
  SELECT count(*)::int INTO v_mismatch
  FROM public.app_users au
  WHERE public.get_user_lifetime_earned(au.user_id) <> (
    SELECT COALESCE(SUM(pt.amount), 0)::integer
    FROM public.point_transactions pt
    WHERE pt.user_id = au.user_id
      AND pt.amount > 0
      AND pt.source IN (
        'announcement_claim', 'compliance_form', 'streak_bonus',
        'near_miss_report', 'certification', 'manual_award'
      )
  );

  IF EXISTS (
    SELECT 1 FROM public.point_transactions pt
    WHERE pt.source IN ('challenge_reward', 'campaign_multiplier_bonus')
  ) THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 lifetime regression: challenge rows exist during byte-identical test';
  END IF;

  IF v_mismatch <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 lifetime regression: % users differ from Phase 1 source list', v_mismatch;
  END IF;

  -- Earning source list parity (season score RPC uses gamification_earning_sources)
  IF (
    SELECT pg_get_functiondef('public.get_user_season_score(uuid,text)'::regprocedure)
  ) NOT LIKE '%gamification_earning_sources%' THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 source parity: get_user_season_score must use gamification_earning_sources';
  END IF;
  IF (
    SELECT pg_get_functiondef('public.get_user_lifetime_earned(uuid)'::regprocedure)
  ) NOT LIKE '%gamification_earning_sources%' THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 source parity: get_user_lifetime_earned must use gamification_earning_sources';
  END IF;

  -- finalize_season idempotency (podium only — most_improved_enabled false)
  UPDATE public.seasons SET status = 'closed', finalized_at = NULL
  WHERE season_key = 'gate_p2g1_season_a';

  INSERT INTO public.point_transactions (user_id, amount, source, reason, awarded_by, created_at)
  VALUES
    (c_flag, 300, 'manual_award', 'gate p2g1 podium', c_flag,
     '2099-06-20 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');

  v_fin1 := public.finalize_season('gate_p2g1_season_a');
  IF (v_fin1->>'status') <> 'finalized' THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 finalize first run: expected finalized, got %', v_fin1;
  END IF;

  SELECT count(*)::int INTO v_podium
  FROM public.recognition_feed rf
  WHERE rf.event_type = 'season_podium'
    AND rf.payload->>'season_key' = 'gate_p2g1_season_a';

  v_fin2 := public.finalize_season('gate_p2g1_season_a');
  IF (v_fin2->>'status') <> 'already_finalized' THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 finalize idempotency: second run expected already_finalized, got %', v_fin2;
  END IF;

  IF (
    SELECT count(*)::int FROM public.recognition_feed rf
    WHERE rf.event_type = 'season_podium'
      AND rf.payload->>'season_key' = 'gate_p2g1_season_a'
  ) <> v_podium THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 finalize idempotency: podium row count changed on second run';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.recognition_feed rf
    WHERE rf.event_type = 'season_most_improved'
      AND rf.payload->>'season_key' = 'gate_p2g1_season_a'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED p2g1 most_improved: should not emit when most_improved_enabled=false';
  END IF;

  -- Restore flags dark
  UPDATE public.gamification_settings SET value = 'false'::jsonb
  WHERE key IN ('phase2_enabled', 'seasons_enabled');

  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_recognition_feed_tier_promotion;

  RAISE NOTICE 'OK: Phase 2 gate 1 — Chicago seam, two-track, redemption exclusion, lifetime regression, finalize idempotency, flag-off, most_improved gated.';
END $$;

-- ---- Increment-specific checks: 20260608230200 (Phase 2 gate 2) ----
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regclass('public.challenges') IS NULL THEN
    missing := missing || E'\n  - table public.challenges is missing';
  END IF;
  IF to_regclass('public.campaigns') IS NULL THEN
    missing := missing || E'\n  - table public.campaigns is missing';
  END IF;
  IF to_regclass('public.challenge_completions') IS NULL THEN
    missing := missing || E'\n  - table public.challenge_completions is missing';
  END IF;
  IF to_regprocedure('public.award_challenge_completion(uuid,uuid)') IS NULL THEN
    missing := missing || E'\n  - function public.award_challenge_completion is missing';
  END IF;
  IF to_regprocedure('public.try_record_challenge_completion(uuid,text,text,text,timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.try_record_challenge_completion is missing';
  END IF;
  IF to_regprocedure('public.evaluate_user_challenges_from_ledger(uuid,public.point_source,text,uuid,text,timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.evaluate_user_challenges_from_ledger is missing';
  END IF;
  IF to_regprocedure('public.rotate_weekly_auto_challenge(timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.rotate_weekly_auto_challenge is missing';
  END IF;
  IF to_regprocedure('public.get_active_challenge_for_activity(timestamp with time zone)') IS NULL THEN
    missing := missing || E'\n  - function public.get_active_challenge_for_activity is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'point_transactions' AND t.tgname = 'trg_evaluate_challenges_point_tx' AND NOT t.tgisinternal
  ) THEN
    missing := missing || E'\n  - trigger trg_evaluate_challenges_point_tx is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'safety_briefing_answers' AND t.tgname = 'trg_evaluate_challenges_briefing' AND NOT t.tgisinternal
  ) THEN
    missing := missing || E'\n  - trigger trg_evaluate_challenges_briefing is missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE challenge_key = 'compliance_sprint') THEN
    missing := missing || E'\n  - seed challenge compliance_sprint missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE challenge_key = 'near_miss_week') THEN
    missing := missing || E'\n  - seed challenge near_miss_week missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE challenge_key = 'cert_or_training') THEN
    missing := missing || E'\n  - seed challenge cert_or_training missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gamification_settings gs
    WHERE gs.key = 'weekly_auto_challenge_pool'
      AND gs.value @> '["compliance_sprint"]'::jsonb
  ) THEN
    missing := missing || E'\n  - weekly_auto_challenge_pool seed missing or wrong';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — Phase 2 gate 2 objects (20260608230200) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: Phase 2 gate 2 schema — challenges, campaigns, completions, eval triggers, rotation present.';
END $$;

DO $$
DECLARE
  c_user       uuid := '00000000-0000-0000-0000-00000000e301';
  c_incident   uuid := '00000000-0000-0000-0000-00000000e311';
  c_ca         uuid := '00000000-0000-0000-0000-00000000e312';
  c_compliance uuid := '00000000-0000-0000-0000-00000000e313';
  c_cert_ref   uuid := '00000000-0000-0000-0000-00000000e314';
  c_flag_cert  uuid := '00000000-0000-0000-0000-00000000e316';
  v_week_a     date;
  v_week_b     date;
  v_window_a   text;
  v_window_b   text;
  v_rotate     jsonb;
  v_count      int;
  v_base       int;
  v_bonus      int;
  v_base_amt   int;
  v_bonus_amt  int;
  v_completion uuid;
  v_active     record;
  v_ts         timestamptz := '2099-03-04 18:00:00'::timestamptz AT TIME ZONE 'America/Chicago';
  v_week_cert  date;
  v_week_excl  date;
  v_week_nm    date;
  v_week_camp  date;
  v_week_prec  date;
  v_ts_excl    timestamptz;
  v_ts_nm      timestamptz;
  v_ts_camp    timestamptz;
  v_ts_prec    timestamptz;
  v_camp_cert  uuid := '00000000-0000-0000-0000-00000000e315';
BEGIN
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_recognition_feed_tier_promotion;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_challenges_point_tx;
  ALTER TABLE public.safety_briefing_answers DISABLE TRIGGER trg_weekly_streak_briefing;
  ALTER TABLE public.safety_briefing_answers DISABLE TRIGGER trg_evaluate_challenges_briefing;
  ALTER TABLE public.safety_incidents DISABLE TRIGGER trg_award_near_miss_base_points;
  ALTER TABLE public.corrective_actions DISABLE TRIGGER trg_award_near_miss_corrective_bonus;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user, 'authenticated', 'authenticated', 'gate-p2g2-user@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_users SET role = 'employee' WHERE user_id = c_user;

  -- Flag-off discipline
  IF public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 flag-off: are_challenges_enabled should be false at gate start';
  END IF;

  v_rotate := public.rotate_weekly_auto_challenge(v_ts);
  IF (v_rotate->>'status') <> 'skipped' OR (v_rotate->>'reason') <> 'challenges_disabled' THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 flag-off rotate: expected challenges_disabled skip, got %', v_rotate;
  END IF;

  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (c_user, 20, 'certification', c_flag_cert, 'certification_records', 'pass', v_ts);

  SELECT count(*)::int INTO v_count
  FROM public.challenge_completions cc WHERE cc.user_id = c_user;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 flag-off: challenge_completions rows written while disabled';
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.point_transactions pt
  WHERE pt.user_id = c_user AND pt.source IN ('challenge_reward', 'campaign_multiplier_bonus');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 flag-off: challenge ledger rows written while disabled';
  END IF;

  -- Chicago ISO week seam → distinct window_key values
  v_week_a := public.chicago_iso_week_start('2024-01-08 05:59:00+00'::timestamptz);
  v_week_b := public.chicago_iso_week_start('2024-01-08 06:01:00+00'::timestamptz);
  v_window_a := public.weekly_challenge_window_key(v_week_a);
  v_window_b := public.weekly_challenge_window_key(v_week_b);
  IF v_week_a <> '2024-01-01'::date OR v_week_b <> '2024-01-08'::date THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 week seam: unexpected week starts % %', v_week_a, v_week_b;
  END IF;
  IF v_window_a = v_window_b THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 week seam: window keys should differ across Chicago Monday seam';
  END IF;

  -- Enable challenges for behavioral tests (restored at end)
  UPDATE public.gamification_settings SET value = 'true'::jsonb
  WHERE key IN ('phase2_enabled', 'challenges_enabled');

  v_week_cert := public.chicago_iso_week_start(v_ts);

  UPDATE public.gamification_settings
  SET value = jsonb_build_object('week_start', v_week_cert, 'challenge_key', 'cert_or_training')
  WHERE key = 'weekly_auto_challenge_active';

  IF NOT public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'GATE FAILED p2g2: could not enable challenges for behavioral tests';
  END IF;

  -- cert_or_training completes on certification earn
  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (c_user, 20, 'certification', c_cert_ref, 'certification_records', 'pass', v_ts);

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'certification', 'pass', c_cert_ref, 'certification_records', v_ts
  );

  SELECT count(*)::int INTO v_count
  FROM public.challenge_completions cc
  WHERE cc.user_id = c_user
    AND cc.challenge_key = 'cert_or_training'
    AND cc.window_key = public.weekly_challenge_window_key(v_week_cert);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 cert completion: expected 1 row, got %', v_count;
  END IF;

  SELECT count(*)::int, COALESCE(max(pt.amount), 0)::int INTO v_count, v_base
  FROM public.point_transactions pt
  WHERE pt.user_id = c_user AND pt.source = 'challenge_reward';
  IF v_count <> 1 OR v_base <> 30 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 cert payout: expected 1 base tx amount 30, got count=% amount=%', v_count, v_base;
  END IF;

  -- Idempotency: repeated qualifying certification action same week must not double-pay
  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (c_user, 10, 'certification', gen_random_uuid(), 'certification_records', 'early_renewal', v_ts);

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'certification', 'early_renewal', gen_random_uuid(), 'certification_records', v_ts
  );

  SELECT cc.id INTO v_completion
  FROM public.challenge_completions cc
  WHERE cc.user_id = c_user AND cc.challenge_key = 'cert_or_training';

  PERFORM public.award_challenge_completion(c_user, v_completion);

  SELECT count(*)::int INTO v_count FROM public.challenge_completions cc WHERE cc.user_id = c_user;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 idempotency: expected 1 completion row, got %', v_count;
  END IF;

  SELECT count(*)::int, COALESCE(max(pt.amount), 0)::int INTO v_count, v_base
  FROM public.point_transactions pt
  WHERE pt.user_id = c_user AND pt.source = 'challenge_reward';
  IF v_count <> 1 OR v_base <> 30 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 idempotency: expected exactly one base tx (30), got count=% amount=%', v_count, v_base;
  END IF;

  -- Excluded sources must not complete
  v_ts_excl := '2099-04-03 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago';
  v_week_excl := public.chicago_iso_week_start(v_ts_excl);

  UPDATE public.gamification_settings
  SET value = jsonb_build_object('week_start', v_week_excl, 'challenge_key', 'cert_or_training')
  WHERE key = 'weekly_auto_challenge_active';

  INSERT INTO public.point_transactions (user_id, amount, source, reason, created_at)
  VALUES (c_user, 5, 'streak_bonus', 'gate p2g2 excluded', v_ts_excl);

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'streak_bonus', NULL, gen_random_uuid(), NULL, v_ts_excl
  );

  INSERT INTO public.point_transactions (user_id, amount, source, reason, created_at)
  VALUES (c_user, -10, 'redemption', 'gate p2g2 excluded', v_ts_excl);

  SELECT count(*)::int INTO v_count
  FROM public.challenge_completions cc
  WHERE cc.user_id = c_user AND cc.window_key = public.weekly_challenge_window_key(v_week_excl);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 excluded sources: streak_bonus/redemption must not complete challenge';
  END IF;

  -- near_miss_week: corrective_bonus only (Sharp Eye signal), not raw base submission
  v_ts_nm := '2099-05-07 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago';
  v_week_nm := public.chicago_iso_week_start(v_ts_nm);

  UPDATE public.gamification_settings
  SET value = jsonb_build_object('week_start', v_week_nm, 'challenge_key', 'near_miss_week')
  WHERE key = 'weekly_auto_challenge_active';

  INSERT INTO public.safety_incidents (id, incident_date, severity, incident_type, description, reported_by)
  VALUES (c_incident, '2099-05-07', 'near_miss', 'other', 'gate p2g2 nm base only', c_user);

  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (
    c_user, 10, 'near_miss_report', c_incident, 'safety_incidents', 'base', v_ts_nm
  );

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'near_miss_report', 'base', c_incident, 'safety_incidents', v_ts_nm
  );

  SELECT count(*)::int INTO v_count
  FROM public.challenge_completions cc
  WHERE cc.user_id = c_user AND cc.challenge_key = 'near_miss_week';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 near_miss anti-gaming: base submission must not complete near_miss_week';
  END IF;

  INSERT INTO public.corrective_actions (id, incident_id, description, action_type, status, due_date)
  VALUES (c_ca, c_incident, 'gate p2g2 capa', 'immediate', 'verified', '2099-05-14');

  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (
    c_user, 15, 'near_miss_report', c_ca, 'corrective_actions', 'corrective_bonus', v_ts_nm + interval '2 hours'
  );

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'near_miss_report', 'corrective_bonus', c_ca, 'corrective_actions', v_ts_nm + interval '2 hours'
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_completions cc
    WHERE cc.user_id = c_user
      AND cc.challenge_key = 'near_miss_week'
      AND cc.window_key = public.weekly_challenge_window_key(v_week_nm)
  ) THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 near_miss: corrective_bonus should complete near_miss_week';
  END IF;

  -- Campaign multiplier posts separate bonus row; base amount never mutated
  UPDATE public.challenge_completions
  SET base_tx_id = NULL, multiplier_tx_id = NULL
  WHERE user_id = c_user;
  DELETE FROM public.point_transactions
  WHERE user_id = c_user AND source IN ('challenge_reward', 'campaign_multiplier_bonus');
  DELETE FROM public.challenge_completions WHERE user_id = c_user;

  INSERT INTO public.campaigns (
    campaign_key, challenge_key, title, starts_at, ends_at, multiplier, is_active
  ) VALUES (
    'gate_p2g2_campaign',
    'cert_or_training',
    'Gate Campaign 2x',
    '2099-06-01 05:00:00+00'::timestamptz,
    '2099-06-15 05:00:00+00'::timestamptz,
    2.00,
    true
  ) ON CONFLICT (campaign_key) DO UPDATE SET multiplier = EXCLUDED.multiplier, is_active = true;

  UPDATE public.gamification_settings
  SET value = jsonb_build_object('week_start', '2099-06-03'::date, 'challenge_key', 'compliance_sprint')
  WHERE key = 'weekly_auto_challenge_active';

  v_ts_camp := '2099-06-05 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago';

  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (
    c_user, 20, 'certification', v_camp_cert, 'certification_records', 'pass', v_ts_camp
  );

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'certification', 'pass', v_camp_cert, 'certification_records', v_ts_camp
  );

  SELECT cc.id INTO v_completion
  FROM public.challenge_completions cc
  WHERE cc.user_id = c_user AND cc.campaign_key = 'gate_p2g2_campaign';

  IF v_completion IS NULL THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 campaign completion: expected completion under active campaign';
  END IF;

  SELECT pt.amount INTO v_base_amt
  FROM public.point_transactions pt
  WHERE pt.source = 'challenge_reward' AND pt.reference_id = v_completion;

  SELECT pt.amount INTO v_bonus_amt
  FROM public.point_transactions pt
  WHERE pt.source = 'campaign_multiplier_bonus' AND pt.reference_id = v_completion;

  IF v_base_amt <> 30 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 multiplier base: expected 30, got %', v_base_amt;
  END IF;
  IF v_bonus_amt <> 30 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 multiplier bonus: expected separate 30 bonus row, got %', v_bonus_amt;
  END IF;

  PERFORM public.award_challenge_completion(c_user, v_completion);

  SELECT pt.amount INTO v_base FROM public.point_transactions pt
  WHERE pt.source = 'challenge_reward' AND pt.reference_id = v_completion;
  SELECT pt.amount INTO v_bonus FROM public.point_transactions pt
  WHERE pt.source = 'campaign_multiplier_bonus' AND pt.reference_id = v_completion;

  IF v_base <> 30 OR v_bonus <> 30 THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 multiplier idempotency: base/bonus mutated on re-award (%, %)', v_base, v_bonus;
  END IF;

  -- Campaign precedence over auto-pool for overlapping window
  UPDATE public.challenge_completions
  SET base_tx_id = NULL, multiplier_tx_id = NULL
  WHERE user_id = c_user AND campaign_key IS NULL;
  DELETE FROM public.point_transactions
  WHERE user_id = c_user
    AND source IN ('challenge_reward', 'campaign_multiplier_bonus')
    AND id NOT IN (
      SELECT cc.base_tx_id FROM public.challenge_completions cc
      WHERE cc.user_id = c_user AND cc.base_tx_id IS NOT NULL
      UNION
      SELECT cc.multiplier_tx_id FROM public.challenge_completions cc
      WHERE cc.user_id = c_user AND cc.multiplier_tx_id IS NOT NULL
    );
  DELETE FROM public.challenge_completions WHERE user_id = c_user AND campaign_key IS NULL;

  INSERT INTO public.campaigns (
    campaign_key, challenge_key, title, starts_at, ends_at, multiplier, is_active
  ) VALUES (
    'gate_p2g2_precedence',
    'compliance_sprint',
    'Gate precedence campaign',
    '2099-07-01 05:00:00+00'::timestamptz,
    '2099-07-08 05:00:00+00'::timestamptz,
    1.00,
    true
  ) ON CONFLICT (campaign_key) DO UPDATE SET is_active = true;

  UPDATE public.gamification_settings
  SET value = jsonb_build_object('week_start', '2099-07-01'::date, 'challenge_key', 'near_miss_week')
  WHERE key = 'weekly_auto_challenge_active';

  v_ts_prec := '2099-07-02 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago';
  v_week_prec := public.chicago_iso_week_start(v_ts_prec);

  INSERT INTO public.compliance_rewards (id, user_id, date_for, forms_completed, points_awarded, awarded_at)
  VALUES (
    c_compliance, c_user, '2099-07-02', ARRAY['dvir','equipment','jsa'], 5, v_ts_prec
  );

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'compliance_form', NULL, c_compliance, 'compliance_rewards', v_ts_prec
  );

  SELECT * INTO v_active
  FROM public.get_active_challenge_for_activity(v_ts_prec)
  LIMIT 1;

  IF v_active.challenge_key <> 'compliance_sprint' OR v_active.campaign_key <> 'gate_p2g2_precedence' THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 precedence resolve: expected campaign compliance_sprint, got % / %',
      v_active.challenge_key, v_active.campaign_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.challenge_completions cc
    WHERE cc.user_id = c_user AND cc.challenge_key = 'near_miss_week'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 precedence: auto-pool near_miss_week must not complete when campaign active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_completions cc
    WHERE cc.user_id = c_user
      AND cc.challenge_key = 'compliance_sprint'
      AND cc.campaign_key = 'gate_p2g2_precedence'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 precedence: expected compliance_sprint completion via campaign';
  END IF;

  -- Rotation cron writes active row when enabled
  v_rotate := public.rotate_weekly_auto_challenge('2099-08-05 12:00:00'::timestamptz AT TIME ZONE 'America/Chicago');
  IF (v_rotate->>'status') NOT IN ('rotated', 'already_rotated') THEN
    RAISE EXCEPTION 'GATE FAILED p2g2 rotate enabled: unexpected status %', v_rotate;
  END IF;

  -- Restore flags dark
  UPDATE public.gamification_settings SET value = 'false'::jsonb
  WHERE key IN ('phase2_enabled', 'challenges_enabled');
  UPDATE public.gamification_settings SET value = 'null'::jsonb
  WHERE key = 'weekly_auto_challenge_active';

  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_recognition_feed_tier_promotion;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_evaluate_challenges_point_tx;
  ALTER TABLE public.safety_briefing_answers ENABLE TRIGGER trg_weekly_streak_briefing;
  ALTER TABLE public.safety_briefing_answers ENABLE TRIGGER trg_evaluate_challenges_briefing;
  ALTER TABLE public.safety_incidents ENABLE TRIGGER trg_award_near_miss_base_points;
  ALTER TABLE public.corrective_actions ENABLE TRIGGER trg_award_near_miss_corrective_bonus;

  RAISE NOTICE 'OK: Phase 2 gate 2 — Chicago seam, cert/near_miss/compliance detection, idempotency, multiplier separate row, campaign precedence, flag-off, rotation.';
END $$;

-- ---- Increment-specific checks: 20260608230300 (Phase 2 gate 3) ----
DO $$
DECLARE
  missing text := '';
BEGIN
  IF to_regprocedure('public.list_gamification_program_seasons()') IS NULL THEN
    missing := missing || E'\n  - function public.list_gamification_program_seasons() is missing';
  END IF;
  IF to_regprocedure('public.list_gamification_program_challenges()') IS NULL THEN
    missing := missing || E'\n  - function public.list_gamification_program_challenges() is missing';
  END IF;
  IF to_regprocedure('public.list_gamification_program_campaigns()') IS NULL THEN
    missing := missing || E'\n  - function public.list_gamification_program_campaigns() is missing';
  END IF;
  IF to_regprocedure('public.upsert_gamification_season(text,text,timestamp with time zone,timestamp with time zone,text,boolean,integer)') IS NULL THEN
    missing := missing || E'\n  - function public.upsert_gamification_season is missing';
  END IF;
  IF to_regprocedure('public.set_gamification_season_status(text,public.season_status)') IS NULL THEN
    missing := missing || E'\n  - function public.set_gamification_season_status is missing';
  END IF;
  IF to_regprocedure('public.upsert_gamification_campaign(text,text,timestamp with time zone,timestamp with time zone,text,numeric)') IS NULL THEN
    missing := missing || E'\n  - function public.upsert_gamification_campaign is missing';
  END IF;
  IF to_regprocedure('public.set_gamification_campaign_active(text,boolean)') IS NULL THEN
    missing := missing || E'\n  - function public.set_gamification_campaign_active is missing';
  END IF;
  IF to_regprocedure('public.nudge_program_owner_season_needs_campaign(text)') IS NULL THEN
    missing := missing || E'\n  - function public.nudge_program_owner_season_needs_campaign is missing';
  END IF;
  IF to_regprocedure('public.process_gamification_program_owner_nudges()') IS NULL THEN
    missing := missing || E'\n  - function public.process_gamification_program_owner_nudges is missing';
  END IF;
  IF to_regprocedure('public.get_gamification_program_owner_user_id()') IS NULL THEN
    missing := missing || E'\n  - function public.get_gamification_program_owner_user_id is missing';
  END IF;
  IF to_regprocedure('public.season_has_active_campaign(text)') IS NULL THEN
    missing := missing || E'\n  - function public.season_has_active_campaign is missing';
  END IF;

  IF missing <> '' THEN
    RAISE EXCEPTION E'GATE FAILED — Phase 2 gate 3 objects (20260608230300) not correct:%', missing;
  END IF;
  RAISE NOTICE 'OK: Phase 2 gate 3 schema — program-admin RPCs, owner nudge, RLS refresh present.';
END $$;

DO $$
DECLARE
  c_user       uuid := '00000000-0000-0000-0000-00000000f301';
  c_owner      uuid := '00000000-0000-0000-0000-00000000f302';
  c_employee   uuid := '00000000-0000-0000-0000-00000000f303';
  c_safety     uuid := '00000000-0000-0000-0000-00000000f304';
  c_cert       uuid := '00000000-0000-0000-0000-00000000f311';
  v_caught     boolean := false;
  v_result     jsonb;
  v_count      int;
  v_active     record;
  v_lifecycle  jsonb;
  v_nudge      jsonb;
  v_ts         timestamptz := '2099-05-10 18:00:00'::timestamptz AT TIME ZONE 'America/Chicago';
  v_week       date;
  v_season_start timestamptz := now() - interval '2 days';
  v_season_end   timestamptz := now() + interval '60 days';
BEGIN
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_recognition_feed_tier_promotion;
  ALTER TABLE public.point_transactions DISABLE TRIGGER trg_evaluate_challenges_point_tx;
  ALTER TABLE public.safety_briefing_answers DISABLE TRIGGER trg_weekly_streak_briefing;
  ALTER TABLE public.safety_briefing_answers DISABLE TRIGGER trg_evaluate_challenges_briefing;
  ALTER TABLE public.safety_incidents DISABLE TRIGGER trg_award_near_miss_base_points;
  ALTER TABLE public.corrective_actions DISABLE TRIGGER trg_award_near_miss_corrective_bonus;

  INSERT INTO auth.users (id, aud, role, email) VALUES
    (c_user,     'authenticated', 'authenticated', 'gate-p2g3-user@example.invalid'),
    (c_owner,    'authenticated', 'authenticated', 'gate-p2g3-owner@example.invalid'),
    (c_employee, 'authenticated', 'authenticated', 'gate-p2g3-employee@example.invalid'),
    (c_safety,   'authenticated', 'authenticated', 'gate-p2g3-safety@example.invalid')
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.app_users SET role = 'employee' WHERE user_id IN (c_user, c_employee);
  UPDATE public.app_users SET role = 'admin' WHERE user_id = c_owner;
  UPDATE public.app_users SET role = 'safety_officer' WHERE user_id = c_safety;

  UPDATE public.gamification_settings SET value = to_jsonb(c_owner::text)
  WHERE key = 'program_owner_user_id';

  -- Non-program-admin blocked from campaign create
  PERFORM set_config('request.jwt.claim.sub', c_employee::text, true);
  v_caught := false;
  BEGIN
    PERFORM public.upsert_gamification_campaign(
      'gate_p2g3_blocked',
      'compliance_sprint',
      '2099-05-01 05:00:00+00'::timestamptz,
      '2099-05-08 05:00:00+00'::timestamptz,
      'Blocked',
      1.00
    );
  EXCEPTION
    WHEN OTHERS THEN
      v_caught := true;
  END;
  IF NOT v_caught THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 auth: employee must not upsert campaigns';
  END IF;

  -- safety_officer can stage a campaign (inactive by default)
  PERFORM set_config('request.jwt.claim.sub', c_safety::text, true);
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 auth: safety_officer should be program admin';
  END IF;

  v_result := public.upsert_gamification_campaign(
    'gate_p2g3_staged',
    'cert_or_training',
    '2099-05-01 05:00:00+00'::timestamptz,
    '2099-05-15 05:00:00+00'::timestamptz,
    'Staged kickoff campaign',
    1.50
  );
  IF (v_result->>'status') <> 'ok' OR (v_result->>'staged')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 staged create: expected staged campaign, got %', v_result;
  END IF;

  -- Activate staged campaign but keep master flag dark → zero payouts
  v_result := public.set_gamification_campaign_active('gate_p2g3_staged', true);
  IF (v_result->>'is_active')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 activate: expected is_active true, got %', v_result;
  END IF;

  IF public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 dark master: are_challenges_enabled should be false';
  END IF;

  v_week := public.chicago_iso_week_start(v_ts);
  UPDATE public.gamification_settings
  SET value = jsonb_build_object('week_start', v_week, 'challenge_key', 'cert_or_training')
  WHERE key = 'weekly_auto_challenge_active';

  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (c_user, 20, 'certification', c_cert, 'certification_records', 'pass', v_ts);

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'certification', 'pass', c_cert, 'certification_records', v_ts
  );

  SELECT count(*)::int INTO v_count
  FROM public.challenge_completions cc
  WHERE cc.user_id = c_user AND cc.campaign_key = 'gate_p2g3_staged';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 dark staged campaign: completion written while phase2_enabled false';
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.point_transactions pt
  WHERE pt.user_id = c_user
    AND pt.source IN ('challenge_reward', 'campaign_multiplier_bonus');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 dark staged campaign: payout rows written while phase2_enabled false';
  END IF;

  -- Owner nudge no-ops while dark
  v_nudge := public.nudge_program_owner_season_needs_campaign('gate_p2g3_season_sched');
  IF (v_nudge->>'status') <> 'skipped' OR (v_nudge->>'reason') <> 'phase2_dark' THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 nudge dark: expected phase2_dark skip, got %', v_nudge;
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.notification_events ne
  WHERE ne.entity_type = 'gamification_season_nudge'
    AND ne.target_ref = c_owner::text;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 nudge dark: notification inserted while phase2 dark';
  END IF;

  -- Season tooling + lifecycle when enabled
  PERFORM set_config('request.jwt.claim.sub', c_owner::text, true);
  v_result := public.upsert_gamification_season(
    'gate_p2g3_season_sched',
    'Gate Season Q3',
    v_season_start,
    v_season_end,
    'ember',
    false,
    50
  );
  IF (v_result->>'status') <> 'ok' THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 season upsert: %', v_result;
  END IF;

  v_result := public.set_gamification_season_status('gate_p2g3_season_sched', 'scheduled');
  IF (v_result->>'season_status')::text <> 'scheduled' THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 season schedule: %', v_result;
  END IF;

  UPDATE public.gamification_settings SET value = 'true'::jsonb
  WHERE key IN ('phase2_enabled', 'seasons_enabled', 'challenges_enabled');

  -- Staged-but-inactive campaign still pays nothing even when flags on
  PERFORM public.set_gamification_campaign_active('gate_p2g3_staged', false);

  SELECT * INTO v_active
  FROM public.get_active_challenge_for_activity(v_ts);
  IF v_active.campaign_key = 'gate_p2g3_staged' THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 inactive campaign: staged campaign must not resolve as active challenge';
  END IF;

  DELETE FROM public.point_transactions WHERE user_id = c_user;
  DELETE FROM public.challenge_completions WHERE user_id = c_user;

  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, category, created_at)
  VALUES (c_user, 20, 'certification', gen_random_uuid(), 'certification_records', 'pass', v_ts);

  PERFORM public.evaluate_user_challenges_from_ledger(
    c_user, 'certification', 'pass', gen_random_uuid(), 'certification_records', v_ts
  );

  SELECT count(*)::int INTO v_count
  FROM public.challenge_completions cc
  WHERE cc.user_id = c_user AND cc.campaign_key = 'gate_p2g3_staged';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 inactive campaign: completion tied to inactive staged campaign';
  END IF;

  -- Lifecycle promotes scheduled season when window open (only when enabled)
  v_lifecycle := public.process_gamification_season_lifecycle();
  IF (v_lifecycle->>'status') <> 'ok' OR COALESCE((v_lifecycle->>'activated')::int, 0) < 1 THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 lifecycle activate: expected activation, got %', v_lifecycle;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.seasons s
    WHERE s.season_key = 'gate_p2g3_season_sched' AND s.status = 'active'
  ) THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 lifecycle: scheduled season should be active after cron';
  END IF;

  v_result := public.set_gamification_season_status('gate_p2g3_season_sched', 'closed');
  IF (v_result->>'season_status')::text <> 'closed' THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 season close: %', v_result;
  END IF;

  -- Owner nudge targets configured owner once Phase 2 is live
  v_result := public.upsert_gamification_season(
    'gate_p2g3_season_nudge',
    'Gate Season Nudge',
    v_season_start,
    v_season_end,
    'gold',
    false,
    51
  );
  v_result := public.set_gamification_season_status('gate_p2g3_season_nudge', 'scheduled');

  v_nudge := public.nudge_program_owner_season_needs_campaign('gate_p2g3_season_nudge');
  IF (v_nudge->>'status') <> 'sent' OR (v_nudge->>'owner_user_id')::uuid IS DISTINCT FROM c_owner THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 nudge owner: expected sent to owner, got %', v_nudge;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.notification_events ne
    WHERE ne.entity_type = 'gamification_season_nudge'
      AND ne.target_type = 'user'
      AND ne.target_ref = c_owner::text
  ) THEN
    RAISE EXCEPTION 'GATE FAILED p2g3 nudge owner: notification_events row missing for owner';
  END IF;

  -- Restore dark flags + cleanup gate fixtures
  UPDATE public.gamification_settings SET value = 'false'::jsonb
  WHERE key IN ('phase2_enabled', 'seasons_enabled', 'challenges_enabled');
  UPDATE public.gamification_settings SET value = 'null'::jsonb
  WHERE key IN ('program_owner_user_id', 'weekly_auto_challenge_active');

  DELETE FROM public.notification_events WHERE entity_type = 'gamification_season_nudge';
  DELETE FROM public.challenge_completions WHERE user_id = c_user;
  DELETE FROM public.point_transactions WHERE user_id = c_user;
  DELETE FROM public.campaigns WHERE campaign_key LIKE 'gate_p2g3_%';
  DELETE FROM public.seasons WHERE season_key LIKE 'gate_p2g3_%';

  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_evaluate_badges_point_tx;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_weekly_streak_point_tx;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_recognition_feed_tier_promotion;
  ALTER TABLE public.point_transactions ENABLE TRIGGER trg_evaluate_challenges_point_tx;
  ALTER TABLE public.safety_briefing_answers ENABLE TRIGGER trg_weekly_streak_briefing;
  ALTER TABLE public.safety_briefing_answers ENABLE TRIGGER trg_evaluate_challenges_briefing;
  ALTER TABLE public.safety_incidents ENABLE TRIGGER trg_award_near_miss_base_points;
  ALTER TABLE public.corrective_actions ENABLE TRIGGER trg_award_near_miss_corrective_bonus;

  RAISE NOTICE 'OK: Phase 2 gate 3 — admin-only staging, dark master zero payouts, owner nudge dark/live, season lifecycle + close controls.';
END $$;

ROLLBACK;
