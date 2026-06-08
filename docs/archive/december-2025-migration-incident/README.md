# December 2025 migration incident (historical)

These documents record how we recovered from a migration-history mismatch and out-of-band RLS fixes in December 2025. They are **not** current runbooks.

**Current policy:** [`docs/CONVENTIONS.md`](../../CONVENTIONS.md) (Supabase database policy) and [`supabase/.localgate/README.md`](../../../supabase/.localgate/README.md).

| File | What it was |
|------|-------------|
| `MIGRATION_RESOLUTION_GUIDE.md` | Manual SQL Editor steps + migration-history patching during the incident |
| `SUPABASE_MIGRATION_RECONCILIATION.md` | Root-cause write-up of the `20251212` version-format mismatch |

The one-off SQL files referenced in those guides (`EMERGENCY_FIX_RLS.sql`, etc.) were retired in Gate 4; their fixes live in committed migrations under `supabase/migrations/`.
