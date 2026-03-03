---
name: create-edge-function
description: Scaffold a Supabase Edge Function (Deno) for ATTS with correct imports, CORS handling, authentication pattern selection (user JWT, admin role check, or internal secret), service role client setup, error responses, and frontend invocation hook.
triggers:
  - "create edge function"
  - "new supabase function"
  - "serverless function"
  - "new deno function"
  - "add backend endpoint"
  - "cron function"
version: 1.0
reviewed: 2026-02-17
---

# Create Edge Function

## Purpose
Scaffolds a Supabase Edge Function following the patterns established by the 21 existing functions. Deno Edge Functions differ significantly from the React frontend — wrong imports, missing CORS, or incorrect auth will cause silent failures.

## Pre-Flight Checklist
- [ ] Function name — kebab-case (e.g., `process-safety-report`)
- [ ] Function type:
  - **User-facing API** — called from frontend via `supabase.functions.invoke()`
  - **Cron/scheduled** — triggered by pg_cron or external scheduler
  - **Internal worker** — called by other functions or webhooks
- [ ] Auth pattern:
  - **User JWT** — frontend calls with user's session token
  - **Admin role** — requires admin role after JWT validation
  - **Internal secret** — server-to-server via `x-internal-key` header
  - **Dual** — supports both JWT and internal secret
- [ ] HTTP methods — usually `POST` only, sometimes `POST, GET`
- [ ] Does it need the service role client? (for admin operations that bypass RLS)

---

## File Structure

```
supabase/functions/<function-name>/
├── index.ts          (entry point — required)
└── deno.json         (optional — only if custom imports needed)
```

For complex functions, split into modules:
```
supabase/functions/<function-name>/
├── index.ts
├── types.ts
├── utils.ts
└── deno.json
```

---

## Step-by-Step

### 1. Create the Function Directory

```bash
mkdir -p supabase/functions/<function-name>
```

### 2. Write `index.ts`

See `references/edge-function-templates.md` for complete templates for each auth pattern.

Key rules:
- Always import `"jsr:@supabase/functions-js/edge-runtime.d.ts"` first
- Use `npm:@supabase/supabase-js@2` for Supabase client (not esm.sh)
- Define `corsHeaders` at the top — always include `X-Client-Info` and `Apikey`
- Handle OPTIONS preflight before any logic
- Wrap all logic in try/catch — never let an unhandled error crash the function
- Return JSON responses with `Content-Type: application/json` and CORS headers
- Use `Deno.env.get()` for secrets — never hardcode

### 3. Frontend Integration (user-facing functions only)

Create or update a hook in `src/hooks/`:
```typescript
import { supabase } from '@/lib/supabaseClient';

export function use<FunctionName>() {
  const invoke = useCallback(async (payload: RequestType) => {
    const { data, error } = await supabase.functions.invoke<ResponseType>(
      '<function-name>',
      { body: payload }
    );
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  return { invoke };
}
```

### 4. Deploy

```bash
supabase functions deploy <function-name>
```

Or via the Supabase MCP tool: `deploy_edge_function`.

---

## Auth Pattern Quick Reference

| Pattern | When to use | Client type |
|---------|------------|-------------|
| User JWT | Frontend calls on behalf of logged-in user | Anon key + auth header |
| Admin role | Admin-only operations from frontend | Anon key + auth header → role check via service client |
| Internal secret | Cron jobs, webhooks, server-to-server | Service role key |
| Dual | Functions callable from both frontend and cron | Check `x-internal-key` first, fall back to JWT |

---

## Environment Variables Available

All Edge Functions have access to:
- `SUPABASE_URL` — project URL
- `SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (full access, bypasses RLS)

Custom secrets (set via `supabase secrets set`):
- `INTERNAL_SECRET` — for internal function-to-function auth
- `OPENAI_API_KEY` — for AI-powered functions
- Check `.env.example` for the full list

---

## After Creation Checklist

- [ ] CORS preflight (OPTIONS) handled before any logic
- [ ] Auth validation present — no function should be callable without authentication
- [ ] Error responses include CORS headers (or the frontend gets a CORS error instead of the real error)
- [ ] All `Deno.env.get()` calls use `!` assertion or have a fallback
- [ ] No `console.log` — Edge Functions don't have the logger utility, but `console.log` is acceptable here (it goes to Supabase function logs, not the browser)
- [ ] Response includes `Content-Type: application/json` header
- [ ] If user-facing: frontend hook created and tested
- [ ] If cron: schedule registered in a migration or via Supabase dashboard

## Anti-Patterns

- **Never** skip CORS headers on error responses — the frontend will see a CORS error instead of the actual error
- **Never** use the service role client for user-initiated operations where RLS should apply — use the anon client with the user's auth header
- **Never** import from `https://deno.land/std@...` for HTTP serving — use `Deno.serve()` (the old `serve()` import is deprecated)
- **Never** return HTML from an API function — always JSON
- **Never** forget to handle the OPTIONS preflight — it will break every frontend call
