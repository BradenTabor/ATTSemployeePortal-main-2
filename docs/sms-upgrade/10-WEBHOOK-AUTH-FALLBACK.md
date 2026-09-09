# Webhook auth fallback — query-parameter shared secret (proposal only)

**Status:** Design contingency. Do **not** implement unless ClickSend inbound rules prove unable to send custom headers.  
**Function today:** `clicksend-inbound-webhook` accepts only:

1. `x-internal-key: <INTERNAL_SECRET>`
2. `Authorization: Bearer <INTERNAL_SECRET>`
3. `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`

No query-string auth exists. Unauthenticated POST → HTTP 401.

## Problem

If ClickSend’s inbound rule UI supports **no** custom headers (neither `x-internal-key` nor `Authorization`), every real STOP/START/HELP POST will 401 and opt-outs will never reach `sms_opt_out_events`.

## Proposal

Accept an optional shared secret as a URL query parameter, e.g.:

`https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook?k=<INTERNAL_SECRET>`

Authorize when **any** of: existing header shapes **or** `k` (or `secret`) equals `INTERNAL_SECRET`. Prefer keeping header paths; query param is fallback only.

### Why this is weaker than a header

- Query strings are more often written to **access logs**, CDN logs, browser history, and Referer headers than custom headers.
- The secret appears in the ClickSend rule URL field (UI screenshots, support exports, shoulder-surfing).
- URL length / logging pipelines are harder to scrub consistently than a single header name.

### Mitigations (required if implemented)

1. **Rotate on exposure** — treat any paste into chat/tickets as compromise; rotate `INTERNAL_SECRET` and update the ClickSend rule URL the same day.
2. **Constant-time compare** — compare `k` to `INTERNAL_SECRET` with a constant-time equality helper (same as header path should use); never early-return on length mismatch in a way that leaks timing.
3. **Log scrubbing** — before any `console`/`logger` of `req.url`, strip `k` / `secret` query params. Do not log full request URLs. Supabase platform logs may still retain the URL — assume residual risk and rotate if a log export is shared.
4. **Least privilege** — do not accept the service-role JWT as a query param (headers only for that). Query param = `INTERNAL_SECRET` only.
5. **Kill switch unchanged** — `sms_inbound_webhook_config.enabled` still gates processing after auth.

### Exact code change (sketch — not applied)

In `supabase/functions/clicksend-inbound-webhook/index.ts`, extend `isAuthorized`:

```ts
function isAuthorized(req: Request): boolean {
  const internalKey = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("k") ?? url.searchParams.get("secret");
  return (
    timingSafeEqual(internalKey, INTERNAL_SECRET) ||
    timingSafeEqual(bearerToken, INTERNAL_SECRET) ||
    timingSafeEqual(bearerToken, SUPABASE_SERVICE_ROLE_KEY) ||
    timingSafeEqual(querySecret, INTERNAL_SECRET)
  );
}
```

ClickSend rule URL becomes the health URL plus `?k=…` (secret from Edge Function secrets, never committed). GET health probe should ignore `k` for the public ok JSON (auth only required on POST).

### Decision rule

Try headers first in the ClickSend UI. Implement this fallback only after a documented failed attempt to attach `x-internal-key` or `Authorization`.
