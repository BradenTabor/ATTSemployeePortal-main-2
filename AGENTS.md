# Agent Instructions (ATTS AI Safety + Compliance Agent)

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

See `AGENTS.md.disabled` for the full safety-agent directives.

## Cursor Cloud specific instructions

### Services overview

This is a **React + Vite + TypeScript** single-page application (ATTS Employee Portal) backed by a cloud-hosted **Supabase** project (PostgreSQL, Auth, Storage, Edge Functions). There is no local database or Docker dependency.

### Environment variables

The app requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a `.env` file at the repo root. These are injected as secrets in the cloud VM environment. To create `.env` from injected secrets:

```bash
python3 -c "
import os
with open('.env', 'w') as f:
    f.write(f'VITE_SUPABASE_URL={os.environ.get(\"VITE_SUPABASE_URL\", \"\")}\n')
    f.write(f'VITE_SUPABASE_ANON_KEY={os.environ.get(\"VITE_SUPABASE_ANON_KEY\", \"\")}\n')
    f.write('VITE_TELEMETRY_ENABLED=false\n')
"
```

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm ci` |
| Dev server | `npm run dev` (port 5173) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test:unit` |
| Build | `npm run build` |
| E2E tests | `npm run test:e2e` (requires Playwright browsers: `npx playwright install`) |

### Known test caveats

- **compliance-helpers.test.ts**: Several timezone-dependent tests (`isWithinRewardClaimWindow`, `getTimeUntilClaimWindowOpens`, `getTimeUntilCutoff`) fail in non-CST environments. These are pre-existing and not caused by setup.
- **rls-policies.test.ts**: Tests that hit the live Supabase Storage API may fail due to network socket issues (transient). Two RLS policy tests fail due to an `infinite recursion detected in policy` error in the Supabase-side policy configuration.
- Unit tests that are purely local (offline queue, form validation, DVIR/JSA validation) pass reliably.

### Gotchas

- The `.env` file is **not** committed to the repo. It must be created from injected secrets before starting the dev server or running the build.
- `npm run build` also runs `bundle:check` which validates chunk sizes. If the build passes, the bundle is within limits.
- The app uses `vite-plugin-pwa` with `injectManifest` strategy; the dev server enables a module-type service worker.
