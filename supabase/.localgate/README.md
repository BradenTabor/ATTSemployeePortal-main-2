# Local validation gate

Pre-apply safety check for Supabase migrations. Baselines from **prod schema** (schema-only, no PII), applies only migrations **newer than prod HEAD**, then runs committed assertions.

Does **not** replay the full migration chain from zero (known ordering issues). Baselines from prod instead.

## Prerequisites

- Local PostgreSQL 17 on `$PGHOST:$PGPORT` (default `127.0.0.1:5432`)
- `PG_BIN` pointing at pg17 binaries if not at `/opt/homebrew/opt/postgresql@17/bin`

## First-time / refresh prod artifacts

Prod-derived artifacts are **gitignored** (they contain hardcoded JWTs in function bodies). Generate them locally:

```bash
# Requires SUPABASE_DB_URL in env or repo .env
bash supabase/.localgate/refresh.sh
```

Produces (schema-only, no data):

- `prod_roles.sql` — cluster roles, no passwords
- `prod_schema.sql` — auth + public DDL
- `prod_applied_versions.txt` — prod migration HEAD

## Run the gate

```bash
bash supabase/.localgate/run.sh
# Optional overrides:
# PG_BIN=/path/to/pg17/bin GATE_DB=atts_gate bash supabase/.localgate/run.sh
```

Steps: recreate throwaway DB → load roles → stubs + prod schema → apply new migrations → run `verify.sql` (sources `assertions.sql`).

## Version control

| File | Tracked? | Purpose |
|------|----------|---------|
| `run.sh`, `refresh.sh`, `stubs.sql` | yes | Reproducible gate tooling |
| `verify.sql`, `assertions.sql` | yes | Assertion entry point + logic |
| `prod_*.sql`, `prod_applied_versions.txt` | **no** | Machine-local prod dumps |

Add new checks in `assertions.sql` per migration increment.
