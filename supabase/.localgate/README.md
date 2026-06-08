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
| `verify.sql`, `config_lock_assertions.sql`, `assertions.sql`, `baseline_anchor.txt` | yes | Assertion entry point + config locks + baseline anchor |
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
| **Manual / pre-re-baseline** (default, Gate 4) | No secrets in CI; runs today with `.env` | Catches drift when **you** run it before apply/re-baseline; blind to out-of-band prod changes by others |
| **Scheduled workflow** (near horizon — before gamification track) | Unattended tripwire | Requires `SUPABASE_DB_URL` GitHub secret; see IPv4 note below |
| **Default `ci.yml` push/PR** | Always on | Needs prod creds on every PR — not recommended |

**Manual tier (ship now):** run `verify_no_drift.sh` before every prod apply and every re-baseline. This is the minimum; do not treat it as sufficient alone.

**Scheduled tier (build next, not "someday"):** add `.github/workflows/db-drift-check.yml` with `workflow_dispatch` + weekly cron so drift fires unattended — the failure mode the manual tier cannot catch is a prod change that bypasses the ritual entirely.

**IPv4 / pooler constraint (decide when building the workflow):** Supabase direct DB hosts are often IPv6-only. GitHub-hosted runners do **not** reliably have IPv6 egress, so a cron that uses the dashboard connection string may fail at runtime even with valid credentials. Prefer the **IPv4-reachable Supabase pooler** endpoint for drift dumps rather than standing up a self-hosted runner solely for this job. This is a known constraint — not a surprise to discover on the first Monday cron.

Do **not** wire drift checks into the default lint/test CI job (no prod secrets in `ci.yml` today).

## Version control (extended)

| File | Tracked? | Purpose |
|------|----------|---------|
| `introspect.sql`, `schema_normalize.sh`, `schema_diff_report.sh` | yes | Shared normalization + diff classification |
| `rebuild_from_baseline.sh`, `prove_rebuild.sh`, `verify_no_drift.sh` | yes | Rebuild proof + drift guard |
| `prod_roles.sql`, `prod_applied_versions.txt` | **no** | Machine-local refresh artifacts |
