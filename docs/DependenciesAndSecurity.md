# Dependencies and Security

Brief notes on dependency hygiene and known audit findings.

## npm audit

After `npm audit fix` (non-breaking), two vulnerabilities remain:

| Package | Severity | Notes |
|--------|----------|--------|
| **jspdf** (≤3.0.4) | Critical | LFI/path traversal. Fix: `npm audit fix --force` installs jspdf@4.x (breaking). Plan a 4.x migration or restrict usage (e.g. no user-controlled paths). |
| **xlsx** (*) | High | Prototype pollution, ReDoS. No fix available. Mitigate: limit parsed file size/source; consider replacing long-term (e.g. SheetJS pro or another library). |

Run `npm audit` periodically. Apply `npm audit fix` for safe updates; review breaking fixes before `npm audit fix --force`.

### Dev-only findings

Some vulnerabilities may appear only in devDependencies (e.g. tooling chains such as hono/MCP). The production bundle does not include these; risk is limited to local/dev use. Optional: upgrade when fixed versions are available in the dependency chain (e.g. hono ≥4.11.7 when pulled in by a direct devDependency).

## Client-only env

All `VITE_*` variables are exposed to the client. Never put secrets in `VITE_*`. Server-only keys (e.g. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) belong in `.env` without the `VITE_` prefix and are used only by Edge Functions or build-time scripts.

## See also

- `.env.example` — documented env vars
- `docs/ProductionReadinessFindings.md` — full audit report
- `vercel.json` / `public/_headers` — security headers
