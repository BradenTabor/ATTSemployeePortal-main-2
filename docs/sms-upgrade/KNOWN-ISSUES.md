# SMS upgrade — known issues (out of scope)

## Full migration replay fails on `20241205_job_tracker`

**Status:** Tracked separately from SMS work. Waived for Chunk 1–3 gates.

**What fails:** Running `supabase db reset` (or replaying all ~170 migrations from zero) errors on `supabase/migrations/20241205_job_tracker.sql` because it references `public.app_users` before that table is created by `20251102034653_create_app_users_table_and_trigger.sql`.

**Why it matters:** No environment can be stood up from migrations alone without a prod baseline or manual fix. Local validation uses `supabase/.localgate/` (prod schema baseline + forward migrations) instead.

**SMS impact:** None. Chunk 1–3 migrations (`20260902120000` … `20260909110000`) apply cleanly after the Sept 2 field-audit migrations via localgate forward replay (+11 verified in Session 2).

**Fix direction (separate task):** Reorder or split `20241205_job_tracker` so FKs to `app_users` are added in a later migration, or document baseline-only provisioning as the supported path.
