# Local validation gate

Pre-apply safety check for Supabase migrations. Rebuilds from **committed prod baseline** (`prod_schema.sql` + `prod_config_data.sql` at `baseline_anchor.txt`), applies **forward migrations** (version > anchor), then runs committed assertions.

Does **not** replay the full migration chain from zero (known ordering issues). Committed baseline + forward migrations instead.

### Config vs data

Schema-only is insufficient for behavioral assertions that exercise config-driven triggers (e.g. `point_rules` → near-miss awards). Tables listed in `config_tables.txt` are dumped with `pg_dump --data-only` and loaded after `prod_schema.sql`. User/activity tables are excluded.

## Prerequisites

- Local PostgreSQL 17 on `$PGHOST:$PGPORT` (default `127.0.0.1:5432`)
- `PG_BIN` pointing at pg17 binaries if not at `/opt/homebrew/opt/postgresql@17/bin`

## First-time / refresh prod artifacts

Machine-local refresh (roles + verification against live prod). **Committed baseline** (`prod_schema.sql`, `prod_config_data.sql`, `baseline_anchor.txt`) is updated only at a deliberate re-baseline — see re-baseline runbook in `docs/CONVENTIONS.md`.

```bash
# Requires SUPABASE_DB_URL in env or repo .env
bash supabase/.localgate/refresh.sh
```

Produces locally (gitignored unless re-baselined):

- `prod_roles.sql` — cluster roles, no passwords
- `prod_applied_versions.txt` — prod migration HEAD (verification)

Re-baseline commits (overwrite at deliberate re-baseline):

- `prod_schema.sql` — auth + public DDL (schema-only)
- `prod_config_data.sql` — config/reference rows (`config_tables.txt`)
- `baseline_anchor.txt` — prod HEAD at last re-baseline

## Run the gate

```bash
bash supabase/.localgate/run.sh
# Optional overrides:
# PG_BIN=/path/to/pg17/bin GATE_DB=atts_gate bash supabase/.localgate/run.sh
```

Steps: recreate throwaway DB → load roles → stubs + committed baseline schema + config data → apply forward migrations → run `verify.sql` (sources `assertions.sql`).

## Version control

| File | Tracked? | Purpose |
|------|----------|---------|
| `run.sh`, `refresh.sh`, `stubs.sql`, `config_tables.txt` | yes | Reproducible gate tooling |
| `verify.sql`, `assertions.sql`, `baseline_anchor.txt` | yes | Assertion entry point + baseline anchor |
| `prod_schema.sql`, `prod_config_data.sql` | yes | Committed DR baseline (re-baseline only) |
| `prod_roles.sql`, `prod_applied_versions.txt` | **no** | Machine-local refresh artifacts |

Add new checks in `assertions.sql` per migration increment.

## Rebuild proof (Gate 3)

Schema-only check that committed baseline + forward migrations reproduce live prod:

```bash
bash supabase/.localgate/prove_rebuild.sh
# artifacts: .tmp/gate3-rebuild/
```

Uses `introspect.sql` → `schema_normalize.sh` (cosmetic filters) → `schema_diff_report.sh`.

## Re-drift guard

Detect prod ↔ repo schema drift with the **same normalization path** as the rebuild proof:

```bash
bash supabase/.localgate/verify_no_drift.sh
# artifacts: .tmp/drift-check/
```

Failure modes (opposite remediations):

| Mode | Meaning | Fix |
|------|---------|-----|
| **PROD-AHEAD** | Object in live prod, not in baseline+forward | Out-of-band SQL — capture as forward migration |
| **REPO-AHEAD** | Object in baseline+forward, not in live prod | Committed migration never applied — apply via MCP |

### Where to run the drift guard

| Home | Pros | Cons |
|------|------|------|
| **Manual / pre-re-baseline** (default) | No secrets in CI; runs today with `.env` | Only catches drift when someone runs it |
| **Scheduled workflow** (`workflow_dispatch` or weekly cron + `SUPABASE_DB_URL` secret) | Unattended tripwire | Requires GitHub secret + IPv6-capable runner or proxy |
| **Default `ci.yml` push/PR** | Always on | Needs prod creds on every PR — not recommended |

**Recommendation:** keep `verify_no_drift.sh` as the canonical check; run it manually before re-baselines and before prod applies. Add an optional `.github/workflows/db-drift-check.yml` with `workflow_dispatch` + weekly schedule when you're ready to store `SUPABASE_DB_URL` as a repo secret. Do **not** wire it into the default lint/test CI job (no secrets today).

## Version control (extended)

| File | Tracked? | Purpose |
|------|----------|---------|
| `introspect.sql`, `schema_normalize.sh`, `schema_diff_report.sh` | yes | Shared normalization + diff classification |
| `rebuild_from_baseline.sh`, `prove_rebuild.sh`, `verify_no_drift.sh` | yes | Rebuild proof + drift guard |
| `prod_roles.sql`, `prod_applied_versions.txt` | **no** | Machine-local refresh artifacts |
