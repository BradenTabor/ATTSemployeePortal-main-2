# Blocked-but-recorded SMS history — non-destructive annotation proposal

**Status:** Proposal only. Do not implement in this session.  
**Constraint:** Do NOT delete or rewrite any historical `sms_message_log` / compat / legacy rows. Do NOT flip opt-out flags for last4 `6644` (Braden decision pending).

## Problem

ClickSend’s opt-out list (`3406168`) has one contact (last4 `6644`, `date_added` 2026-03-04T22:51:37Z). After that timestamp the app continued to enqueue SMS to that number. ClickSend / the carrier blocked delivery, but `sms_message_log_compat` still presents those rows as ordinary sends (legacy branches have no carrier-level “blocked” status). Compliance export currently reads them as sent — a false audit trail.

**Scope confirmed:** ClickSend opt-out list size = **1**. Only last4 **6644** is affected (**726** live compat rows with `sent_at >=` opt-out). No other distinct numbers appear on the provider opt-out list.

## Recommended approach (derived flag, no row rewrites)

Add a **read-only** annotation layer — prefer extending `sms_message_log_compat` (or a thin view on top of it used by the export) with a computed boolean / enum. Do not UPDATE historical tables.

### Sources of truth (in priority order)

1. `sms_opt_out_events` — once webhook/reconcile apply is trusted (empty today; apply still off).
2. ClickSend opt-out list snapshot — today: one E.164 ending `6644`, opted 2026-03-04T22:51:37Z. Until reconcile writes events, seed a small reference table **or** hard-code the known list-id contact into a `sms_provider_opt_out_snapshot` table populated by the nightly reconcile (diff-only → snapshot upsert, still no app_users flag changes unless apply_enabled).

### Derived columns (sketch)

| Column | Meaning |
|--------|---------|
| `carrier_blocked_known_opt_out` | `true` when phone matches a known provider opt-out **and** `sent_at >= opt_out_at` |
| `carrier_block_reason` | e.g. `'clicksend_opt_out_list'` |
| `provider_opt_out_at` | timestamptz of the STOP / list add |

Export UI: show status as **“Provider accepted / carrier blocked (known opt-out)”** when the flag is true; keep raw `provider_status` unchanged.

### SQL sketch (illustrative — not applied)

```sql
-- Optional durable snapshot written by reconcile (no app_users updates)
CREATE TABLE IF NOT EXISTS public.sms_provider_opt_out_snapshot (
  phone_e164 text PRIMARY KEY,
  source text NOT NULL DEFAULT 'clicksend_opt_out_list',
  provider_list_id text,
  opted_out_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sms_provider_opt_out_snapshot ENABLE ROW LEVEL SECURITY;
-- admin SELECT only; service_role upsert

-- Annotating view (extends compat; no base-row rewrites)
CREATE OR REPLACE VIEW public.sms_message_log_compat_annotated AS
SELECT
  c.*,
  (s.phone_e164 IS NOT NULL AND c.sent_at >= s.opted_out_at) AS carrier_blocked_known_opt_out,
  CASE
    WHEN s.phone_e164 IS NOT NULL AND c.sent_at >= s.opted_out_at
      THEN 'clicksend_opt_out_list'
    ELSE NULL
  END AS carrier_block_reason,
  s.opted_out_at AS provider_opt_out_at
FROM public.sms_message_log_compat c
LEFT JOIN public.sms_provider_opt_out_snapshot s
  ON public.normalize_phone_to_e164(c.phone_e164)
   = public.normalize_phone_to_e164(s.phone_e164);

-- Point ComplianceDataExportPanel at the annotated view (or add columns via join in the loader).
```

### Seed for the known 6644 case (still non-destructive)

```sql
INSERT INTO public.sms_provider_opt_out_snapshot (phone_e164, provider_list_id, opted_out_at)
VALUES ('+18703656644', '3406168', '2026-03-04 22:51:37+00')
ON CONFLICT (phone_e164) DO UPDATE
  SET last_seen_at = now(), opted_out_at = EXCLUDED.opted_out_at;
-- Does NOT touch app_users.sms_*_opt_out
```

## Alternatives considered

| Option | Why not (now) |
|--------|----------------|
| UPDATE `provider_status` on historical rows | Rewrites audit trail; violates additive-only constraint |
| DELETE blocked rows | Destroys evidence |
| Flip `app_users` opt-out flags to suppress future sends | Correct long-term, but **explicitly deferred** for 6644 pending Braden’s conversation |
| Only filter export with a hard-coded last4 | Fragile; prefer snapshot table driven by reconcile |

## Implementation order (future session)

1. Snapshot table + RLS + reconcile upsert (still `apply_enabled=false` for app_users).
2. Annotated view + export column.
3. E2E: export shows annotated status for post-opt-out 6644 rows; pre-opt-out rows unchanged.
4. Separately: Braden decides whether to set app flags for 6644.
