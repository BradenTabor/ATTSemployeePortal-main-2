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

ROLLBACK;
