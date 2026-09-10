# Webhook auth fallback — query-parameter shared secret (**implemented**)

**Status:** Implemented 2026-09-10.  
**Function:** `clicksend-inbound-webhook`

## Why this exists

ClickSend support confirmed in writing (**2026-09-09**):

1. Inbound SMS rules let you enter a **destination URL only**. There is **no field** for custom HTTP headers — not `x-internal-key`, not `Authorization: Bearer`.
2. ClickSend POSTs inbound message data as **`application/x-www-form-urlencoded`**.

Both facts broke the previous webhook (header-only auth + `req.json()` only). This fallback is the production auth path for ClickSend; header auth remains for internal/synthetic tests.

## Auth order (additive)

1. `x-internal-key: <INTERNAL_SECRET>`
2. `Authorization: Bearer <INTERNAL_SECRET>`
3. `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (headers only — never as a query param)
4. `?k=<CLICKSEND_WEBHOOK_SECRET>` — **only when that secret is set**

If `CLICKSEND_WEBHOOK_SECRET` is unset/empty, the query-param path is **disabled entirely**. An unset secret never means “allow”.

### Dedicated secret (not `INTERNAL_SECRET`)

`INTERNAL_SECRET` is shared with other internal functions. Putting it in a URL would leak it through referrers, proxy logs, browser history, and screenshots, and would compromise all of those functions at once.

`CLICKSEND_WEBHOOK_SECRET` is single-purpose: used only by this webhook’s `?k=` check. Rotate it independently if exposed.

Compare with a constant-time helper (`timingSafeEqual` on UTF-8 bytes; length mismatch returns false immediately).

## ClickSend rule URL

```
https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook?k=<SECRET>
```

Paste that into ClickSend’s **URL field and nothing else**. The URL itself is credential-bearing — do not share, screenshot, or paste into a support ticket.

GET health probes ignore auth (public `{"ok":true,...}`). Auth is required on POST only.

## Log scrubbing

In-function: every `console.*` that touches the request URL uses `redactUrl()`, which replaces `k`’s value with `[REDACTED]`. Never log the raw URL from this function.

### Residual risk (accepted, documented)

**Supabase platform-level request logging (API gateway / Edge runtime infrastructure) is outside the function’s control and will still capture the full request URL, including `?k=<secret>`.** In-function scrubbing does not remove that.

**Mitigation:** the secret is single-purpose (`CLICKSEND_WEBHOOK_SECRET`). Rotating it affects only this one ClickSend inbound rule — update the rule URL the same day. Treat any paste into chat/tickets/log exports as compromise.

## Body parsing

| Content-Type | Behavior |
|---|---|
| `application/x-www-form-urlencoded` | `URLSearchParams` (ClickSend production) |
| `application/json` | `JSON.parse` (internal tests) |
| missing / other | try form, then JSON; both fail → **200** `{skipped:true, reason:"unparseable_body"}` (not 500 — avoids ClickSend retry storms) |

Both shapes normalize to one internal payload before keyword / E.164 / idempotency / insert logic.

Field names: documented ClickSend inbound SMS object keys (`message_id`, `from`, `to`, `body`, `original_body`, `original_message_id`, `timestamp`, `timestamp_send`, `custom_string`, `_keyword`). Help article confirms form-urlencoded but does not enumerate parameter names; we map the API object keys.

**Message text resolution (2026-09-10):** `resolveInboundMessageText` picks the first non-empty string after trim, preferring `body` then `original_body`. Do **not** use `??` — empty string is a live ClickSend case under keyword-scoped inbound rules. Both empty/whitespace → 200 `{skipped:true, reason:"empty_body"}` with an `OTHER` audit row (distinct from `unknown_keyword`).

**received_at resolution (2026-09-10):** use `timestamp` only. Never fall back to `timestamp_send` (that is the original outbound send time on inbound objects). Missing/invalid `timestamp` → `now()`. `timestamp_send` is retained on the normalized payload and logged as non-authoritative. String timestamps are coerced and validated (reject before 2020 or >24h future → fall back to now).

## Kill switch unchanged

`sms_inbound_webhook_config.enabled` still gates processing after auth.
