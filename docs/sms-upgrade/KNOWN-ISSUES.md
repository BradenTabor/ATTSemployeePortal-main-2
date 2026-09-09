# SMS upgrade — known issues (out of scope)

## Full migration replay fails on `20241205_job_tracker`

**Status:** Tracked separately from SMS work. Waived for Chunk 1–3 gates.

**What fails:** Running `supabase db reset` (or replaying all ~170 migrations from zero) errors on `supabase/migrations/20241205_job_tracker.sql` because it references `public.app_users` before that table is created by `20251102034653_create_app_users_table_and_trigger.sql`.

**Why it matters:** No environment can be stood up from migrations alone without a prod baseline or manual fix. Local validation uses `supabase/.localgate/` (prod schema baseline + forward migrations) instead.

**SMS impact:** None. Chunk 1–3 migrations (`20260902120000` … `20260909110000`) apply cleanly after the Sept 2 field-audit migrations via localgate forward replay (+11 verified in Session 2).

**Fix direction (separate task):** Reorder or split `20241205_job_tracker` so FKs to `app_users` are added in a later migration, or document baseline-only provisioning as the supported path.

---

## `supabase db push` blocked by remote/local migration history mismatch

**Status:** Documented 2026-09-09 (post Chunks 1–3 deploy). **Do not repair the full history in an SMS session.**

**Symptom:** `supabase db push` / `db push --dry-run` fails with:

`LegacyDbPushMissingLocalError: Remote migration versions not found in local migrations directory.`

**Root cause:** Production `supabase_migrations.schema_migrations` contains **24 remote-only version IDs** for June 2026 gamification / field-audit work that were applied under different timestamps than the filenames in this repo. Local has the parallel set under different version stamps (**20 local-only** files). Same logical work, divergent version keys — classic “applied via dashboard/MCP/CLI with a different clock than the committed migration filename” drift.

Remote-only examples (do not revert here): `20260608154819` … `20260608194206`, `20260627161112` … `20260628033929`.

Local-only examples (would try to apply on a naïve push): `20260608120000` … `20260608230400`, `20260627120000` … `20260627170000`.

**SMS impact at deploy:** Blocked applying `20260902200000` / `20260909100000` / `20260909110000` via `db push`. Workaround used: `npx supabase db query --linked -f <migration.sql>` then `supabase migration repair --status applied <versions>`. Those three SMS versions **are** present in `schema_migrations` (verified post-deploy); a future push will neither re-apply nor miss them — but push remains blocked until the June divergence is repaired as its own task.

**Fix direction (separate task):** Align version IDs (repair remote→match local filenames, or rename local files to match remote + `migration repair`), then confirm `db push --dry-run` is clean. Prefer a dedicated migration-history PR, not an SMS chunk.
