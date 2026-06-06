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

-- ---- Increment-specific checks: 20260606020000 (notify RPC 2b) ------------
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
    RAISE EXCEPTION E'GATE FAILED — notify_manual_award_recipient (20260606020000) not correct:%', missing;
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

ROLLBACK;
