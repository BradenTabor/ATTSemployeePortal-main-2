# Chunk 4 plan — sender registry (revised by ClickSend account facts)

**Status:** Plan only. Do **not** implement in this session.  
**Branch:** `feat/sms-upgrade`

## Account facts (2026-09-09 audit)

| E.164 | Notes (ClickSend) | Toll-free status | Role in traffic |
|-------|-------------------|------------------|-----------------|
| `+18338612650` | PO# | REGISTERED | ~55% of recent ClickSend history — **purchase-order approval SMS** (bodies contain “purchase order” / “PO Approval”). Not sent by this portal’s three scheduled Edge Functions. API username observed: `shane@alltts.com`. |
| `+18443781444` | RTO# | REGISTERED | Portal scheduled SMS default (reminder / escalation / payroll hardcode). Escalation + reminder + payroll live here today. |
| `+18335183807` | Safety# | REGISTRATION_INITIATED | **Unused** for outbound. Intended home for safety briefing + escalation once registered. |

~~`CLICKSEND_FROM_NUMBER` secret is **unset** in prod.~~ **Set 2026-09-09 to `+18443781444` (RTO#).** Mass SMS previously omitted `from`, so ClickSend fell back to the account default — observed as PO# in practice — which meant a blast could originate from a number whose STOP replies are not wired to anything. Verified by `send-mass-sms` dry-run: `fromNumber` now reports `+18443781444` where it previously reported `null`. No-op for reminder / escalation / payroll, which already hardcode the same number.

> **This secret is a stopgap, and Chunk 4 removes it.** It is a single global sender for every message type, which is exactly the thing the sender registry exists to replace: once routing rules resolve a `from` per category, this secret degrades to an optional override and should be deleted rather than left as a second, invisible source of truth. Step 6 under “Migration without changing live sends” is where it goes.

### Why the “from” distribution looks wrong (finding, not guess)

Code hardcodes `+18443781444` for reminder / escalation / payroll. The majority share on `+18338612650` is **out-of-repo PO approval traffic** sharing the same ClickSend account — confirmed by message bodies on the live history API, not by inference from percentages alone. Portal mass SMS with unset `from` can add additional PO#-attributed volume but is not the main driver of the 55% split in recent history.

## Goals

1. `sms_sender_numbers` registry: E.164, purpose, toll-free verification status, last verified.
2. Per-message-type routing: safety briefing + escalation → Safety#; payroll → dedicated purpose; mass → explicit number (never empty).
3. Documented fallback when a purpose has no REGISTERED number.
4. Migrate **without** changing which physical number sends safety traffic while Safety# is still `REGISTRATION_INITIATED`.

## Schema sketch

```sql
CREATE TABLE public.sms_sender_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  e164 text NOT NULL UNIQUE,              -- +1...
  purpose text NOT NULL,                  -- safety | payroll | rto | po | mass | general
  label text,                             -- human note, e.g. 'Safety#'
  verification_status text NOT NULL,      -- registered | registration_initiated | unverified | retired
  is_default_for_purpose boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sms_sender_numbers_purpose_check
    CHECK (purpose IN ('safety','payroll','rto','po','mass','general'))
);

-- At most one default per purpose among active rows (partial unique index)
CREATE UNIQUE INDEX sms_sender_one_default_per_purpose
  ON public.sms_sender_numbers (purpose)
  WHERE active AND is_default_for_purpose;

ALTER TABLE public.sms_sender_numbers ENABLE ROW LEVEL SECURITY;
-- admin SELECT/ALL; service_role full; no employee write
```

Seed (reflect reality, do not invent registration):

| e164 | purpose | status | default? |
|------|---------|--------|----------|
| +18335183807 | safety | registration_initiated | true (intent) |
| +18443781444 | rto | registered | true |
| +18443781444 | safety | registered | **false** — temporary **fallback target** only |
| +18443781444 | payroll | registered | true (until a payroll-specific number exists) |
| +18338612650 | po | registered | true |
| +18338612650 | mass | registered | true **or** explicit mass row — never blank `from` |

(Same E.164 may appear on multiple purpose rows, or use a junction `sms_sender_purpose_map` if cleaner — prefer junction if one number serves many purposes.)

## Routing rules

| message_type | Desired purpose | While Safety# unverified |
|--------------|-----------------|---------------------------|
| `safety_briefing_reminder` | safety | Fall back to RTO# (`+18443781444`) — **same number as today** |
| `safety_briefing_escalation_t1/t2` | safety | Same fallback |
| `payroll_reminder` | payroll | Keep RTO# (current behavior) |
| `mass_sms` | mass | Require explicit registered number; refuse send if missing (dry-run still ok) |
| future `cert_expiry` / `heat_alert` | safety | Same as briefing |

Shared helper (Chunk 4 code):

```ts
resolveFromNumber(purpose: SmsPurpose, opts?: { allowFallback: boolean }): string
```

- Lookup `sms_sender_numbers` where `purpose` + `active` + `verification_status = 'registered'` + `is_default_for_purpose`.
- If none and `allowFallback`: use documented fallback purpose (`safety` → `rto` number) and log `from_resolution: 'fallback:<purpose>'` on the unified log row (additive column or `opt_out_state_at_send`-style jsonb metadata — prefer a nullable `from_resolution text` on `sms_message_log`).
- If none and no fallback: throw / return dry-run error; **do not** send with empty `from`.

## Fallback policy (document in runbook + code comment)

1. **Safety purpose, Safety# not REGISTERED:** use RTO# (`+18443781444`). Emit structured log + optional admin metric. Do not use PO#.
2. **Mass purpose, no registered mass number:** abort send (admin UI error). Never inherit ClickSend account default silently.
3. **PO purpose:** owned by the external PO system; portal must not route crew operational SMS to PO#.
4. When Safety# flips to REGISTERED: set `is_default_for_purpose` on Safety#, clear safety-fallback dependency, redeploy — **one config change**, no message-type logic rewrite.

## Migration without changing live sends (Safety# still pending)

1. Add table + seed matching **current** effective senders (RTO# for safety+payroll; PO# recorded but unused by portal scheduled paths).
2. Replace hardcoded `CLICKSEND_FROM_NUMBER ?? "+18443781444"` with `resolveFromNumber(...)` that returns the **same** E.164 under current seed.
3. Mass SMS: set `from` from registry `mass` purpose (initially PO# or RTO# — **Braden chooses**). The empty-`from` case this step guarded against is already closed by the `CLICKSEND_FROM_NUMBER` stopgap above; the registry supersedes it rather than fixing it again.
4. Do **not** point safety traffic at `+18335183807` until ClickSend status is REGISTERED (verify via audit script / numbers API).
5. Dry-run all four functions; confirm `from_number` on `sms_message_log` matches pre-change.
6. Remove hardcode defaults from Edge Functions, then **delete the `CLICKSEND_FROM_NUMBER` secret**. Leaving it set once the registry is authoritative gives two answers to “which number sends this?”, and the secret is the one nobody will think to check.

## F.3 — The three RTO# failures in the 2026-09-09 audit window

ClickSend `sms/history` page used by `clicksend-audit.sh` (first ~100 rows returned for `limit=1000`) showed **3** Failed sends from `+18443781444`:

| UTC date | Recipient last4 | status_code | status_text / error |
|----------|-----------------|-------------|---------------------|
| 2026-05-11T10:40:03Z | `4451` | 301 | Rejected by the recipient network / Unknown error |
| 2026-05-12T10:40:02Z | `4451` | 301 | Rejected by the recipient network / Unknown error |
| 2026-05-13T10:40:02Z | `4421` | 301 | Rejected by the recipient network / Unknown error |

Bodies were safety-briefing reminders. Broader pagination (1000 rows) shows **more** historical 301s on RTO# (dozens, mostly May–Jun 2026, same “Rejected by the recipient network” class) — the audit’s “3” is the count inside that first page, not lifetime. Not Absent-Subscriber wording in this refresh; treat as carrier reject / unreachable handset class.

## Out of scope for Chunk 4

- Changing safety overdue/tiering logic.
- Flipping opt-out flags.
- Rewriting historical log rows.
- Implementing PO approval SMS inside this portal.
- Enabling Safety# sends before registration completes.

## Acceptance checks

- [ ] Registry lists all three toll-free numbers with correct verification_status.
- [ ] Reminder/escalation/payroll dry-run still show `from=+18443781444` while Safety# is initiated.
- [ ] Mass SMS dry-run shows a non-null `fromNumber` from registry.
- [ ] Unit tests for `resolveFromNumber` fallback matrix.
- [ ] Docs: cron inventory / SMS runbook note the fallback rule.
- [ ] Lint / typecheck / build pass.
