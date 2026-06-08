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
