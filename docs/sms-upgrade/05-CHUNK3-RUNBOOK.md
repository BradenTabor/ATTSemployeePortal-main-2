# Chunk 3 Runbook — Inbound Opt-Out Sync

For admins and operators. No developer shell access required for dashboard steps.

## What this chunk does

When a crew member replies **STOP** to an ATTS SMS, ClickSend records the number on its opt-out list. ~~ClickSend blocks future sends at the carrier.~~ **Withdrawn 2026-09-09 — it does not.** That list is only consulted for sends addressed to a contact list; the portal sends ad-hoc to a raw `to` number, so nothing at the carrier suppresses the send. This chunk:

1. Records the inbound message in `sms_opt_out_events`
2. Sets **both** `sms_operational_opt_out` and `sms_marketing_opt_out` to `true` on the matching employee (`app_users`)
3. Nightly reconciliation (disabled by default) compares ClickSend’s opt-out list to the app

**Important (updated 2026-09-09):** setting the flags is only half the job — the flags are what the send paths read. Reminder and escalation **now filter** on `sms_operational_opt_out`, matching payroll. See [Deferred: send-path filters](#deferred-send-path-filters), which records why the deferral was lifted.

**Production webhook URL:**

`https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook`

---

## 1. Deploy Edge Functions

Developer step (one time per environment):

```bash
supabase functions deploy clicksend-inbound-webhook --no-verify-jwt
supabase functions deploy clicksend-optout-reconcile --no-verify-jwt
```

Ensure these secrets exist on the project (Supabase Dashboard → Edge Functions → Secrets):

| Secret | Purpose |
|--------|---------|
| `CLICKSEND_WEBHOOK_SECRET` | **ClickSend inbound rule URL** (`?k=`). Dedicated; used by nothing else. |
| `INTERNAL_SECRET` | Header auth for internal/synthetic POSTs (not usable in ClickSend UI) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase |
| `CLICKSEND_USERNAME` / `CLICKSEND_PASSWORD` | Only needed for reconciliation (not inbound webhook) |

---

## 2. Point ClickSend inbound rule at the webhook

### Before you start (pre-flight)

Run these in the Supabase SQL editor (project `emqqxfzahmwnehxcpxzp`) so wiring does not fail silently:

```sql
SELECT key, value
FROM public.app_settings
WHERE key IN ('sms_inbound_webhook_config', 'sms_optout_reconcile_config');
```

Expect:

- `sms_inbound_webhook_config` → `{"enabled": true}`  
  If this row is missing, the webhook **still processes** inbound (it only skips when `enabled === false`). Prefer the row present and `true`.
- `sms_optout_reconcile_config` → `{"apply_enabled": false}`  
  Leave apply off until a week of diffs is reviewed.

**Where to find `CLICKSEND_WEBHOOK_SECRET`:** Supabase Dashboard → Edge Functions → Secrets → `CLICKSEND_WEBHOOK_SECRET`. Copy it only into the ClickSend rule **URL** as `?k=<value>`. Do not paste it into chat, tickets, screenshots, or this runbook. Do **not** put `INTERNAL_SECRET` in the URL.

Confirm GET health:

```bash
curl -sS "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook"
# → {"ok":true,"name":"clicksend-inbound-webhook"}
```

### Exact ClickSend dashboard steps (Braden — web UI only)

1. Log in to [ClickSend Dashboard](https://dashboard.clicksend.com) as the ATTS account (`shane@alltts.com` / All Terrain Tree Service).
2. Go to **SMS** → **Inbound SMS** / **Rules** (or **Numbers** → inbound settings, depending on UI version).
3. **Wire `+18443781444` (RTO #) only. Do NOT touch `+18338612650` (PO #) yet.**

   An earlier version of this runbook told you to wire both numbers. That instruction was written before we established that **PO# carries purchase-order approval SMS from an application outside this repo, on the same ClickSend account** (see `01-DISCOVERY-REPORT.md` → “Shared ClickSend account”). Adding or replacing an inbound rule on PO# could break or silently overwrite a rule that the purchase-order system depends on, and we do not own that system.

   **Pre-conditions before PO# is wired at all — both must be answered in writing:**

   - [ ] **(a)** Who owns the purchase-order approval application (`webhook-approval-for-6061.bolt.host`)? Named person or team.
   - [ ] **(b)** Does PO# already have an inbound rule? If yes, what is its target URL, and would adding ours replace it or run alongside it? ClickSend’s UI does not always make “replace vs add” obvious — confirm before saving anything.

   Until both are answered, PO# stays untouched. Same for `+18335183807` (Safety #) — it is still `REGISTRATION_INITIATED`, so there is nothing to wire.

   **What wiring RTO# alone does and does not cover:** every scheduled portal send path (reminder, escalation, payroll) resolves `from` to `+18443781444`, so all of that traffic is covered. The one gap is **admin mass SMS**, which sends with no explicit `from` and lets ClickSend pick an account number — observed to pick PO# about 55% of the time. Close that gap by setting `CLICKSEND_FROM_NUMBER` to `+18443781444` (see [§2a](#2a-pin-the-mass-sms-sender-first)) rather than by wiring PO#.
4. Add an **Inbound Rule** on RTO# only:
   - **Action:** Forward to URL (POST)
   - **URL (credential-bearing):**  
     `https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook?k=<CLICKSEND_WEBHOOK_SECRET>`  
     Replace `<CLICKSEND_WEBHOOK_SECRET>` with the Edge Function secret of that name. Paste this into the URL field **only** — ClickSend has no header fields (support confirmed in writing 2026-09-09; see `10-WEBHOOK-AUTH-FALLBACK.md`).
   - **Method:** POST (form-urlencoded — ClickSend’s default for URL actions)
5. Save the rule. Treat the saved URL as a secret: do not screenshot it or paste it into tickets/chat.
6. Smoke-test only with the ranked options in [§7](#7-verify-inbound-stop-smoke-test). Prefer ClickSend’s simulator / HELP before any real STOP.
7. Leave nightly reconcile cron **disabled** until a full week of diff-only runs has been reviewed.

### 2a. Pin the mass-SMS sender first

**Recommended: do this before step 4, not after.** Wiring inbound on RTO# only is complete *if* nothing the portal sends can come from another number. Mass SMS is the one path that can.

Set the Edge Function secret `CLICKSEND_FROM_NUMBER = +18443781444` (Supabase Dashboard → Edge Functions → Secrets).

Why this is a small change, not a risky one:

| Send path | `from` today | After setting the secret |
|---|---|---|
| `safety-briefing-reminder-sms` | `CLICKSEND_FROM_NUMBER ?? "+18443781444"` | unchanged — already resolves to RTO# |
| `safety-briefing-escalation-sms` | same | unchanged |
| `payroll-hours-reminder-sms` | same | unchanged |
| `send-mass-sms` | `CLICKSEND_FROM_NUMBER ?? ""` → ClickSend picks | pinned to RTO# |
| Purchase-order app (external) | its own config | unaffected — it does not read Supabase secrets |

So three of four paths are a literal no-op, one path stops being able to emit from an unwired number, and the external PO system cannot be touched by this. Chunk 4 replaces the env var with the sender registry and should delete it then; note that in `09-CHUNK4-PLAN.md` when you set it.

### 2b. Why this cannot be created from the API — checked 2026-09-10

An agent session was authorised to create this rule over the ClickSend REST API. It did not,
and this section records why so that nobody re-litigates it.

**The API can create inbound rules.** `POST /v3/automations/sms/inbound` exists and is
documented. Body: `dedicated_number`, `rule_name`, `message_search_type`, `message_search_term`,
`action`, `action_address`, `enabled`, and `webhook_type` (required when `action = URL`).
`GET` on the same path lists rules; `DELETE /v3/automations/sms/inbound/{inbound_rule_id}`
removes one. So "the API does not support it" is **false** and should not be written down as
the reason.

**Auth cannot be a header.** There is no header field anywhere in the inbound rule model —
not in ClickSend's own docs, not in their PHP SDK's `InboundSMSRule`, not in the OpenAPI
spec, and **ClickSend support confirmed in writing 2026-09-09** that the UI offers a URL
field only. `webhook_type` selects `post` / `get` / `json` (encoding), not authentication.
Production auth is therefore the URL query parameter `?k=<CLICKSEND_WEBHOOK_SECRET>`
(implemented 2026-09-10 — see `10-WEBHOOK-AUTH-FALLBACK.md`). Creating the rule via API
with `action_address` set to that full URL is possible; this runbook still prefers the
dashboard so a human owns the secret paste.

**Three wildcard rules already apply to RTO#.** No rule is scoped to `+18443781444`
specifically, but all three existing rules use `dedicated_number: "*"`, which matches every
number on the account including RTO#:

| `inbound_rule_id` | Rule name | Match | Action | Target |
|---|---|---|---|---|
| 2126344 | Send to messenger | type 5, `stop` | `SEND_TO_MESSENGER` | — |
| 2126345 | Opt-out contact | starts with `stop` | `MOVE_CONTACT` | list `3406168` (Opt-Out List) |
| 2126343 | Default rule | any message | `EMAIL_USER` | account email |

Rule 2126345 is the mechanism that put last-4 `6644` on the opt-out list in March. **Do not
delete or repoint any of these.** A new `URL` rule is expected to run alongside them, not
replace them — but ClickSend's UI does not state that clearly, which is exactly why this is a
dashboard step for a human and not an API call from a script.

### 2c. Exact dashboard click-path — Braden

Do this in the browser. Paste the credential-bearing URL into the URL field only.

1. Sign in at <https://dashboard.clicksend.com> as the ATTS account (`shane@alltts.com`).
2. Left nav → **SMS** → **Inbound SMS**. If that entry is not present, **Automations** →
   **SMS** → **Inbound**. Both land on the same rules list.
3. You should see the three rules in the table above. Leave every one of them alone.
4. Click **Create new rule** (top right; some account skins label it **+ Add Rule**).
5. Fill the form:
   - **Dedicated number** — pick `+18443781444` from the dropdown. **Not** `*`, and **not**
     `+18338612650` (PO#, Braden's Bolt purchase-order app — see §2 and `12-BRADEN-TODO.md`).
   - **Rule name** — `ATTS portal inbound opt-out`
   - **When message** — *Any message* (search type 0). Leave the search term empty. The
     webhook parses STOP / START / HELP itself; filtering here would drop the others.
   - **Action** — *Forward to URL*
   - **URL** —  
     `https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook?k=<CLICKSEND_WEBHOOK_SECRET>`  
     Copy `CLICKSEND_WEBHOOK_SECRET` from Supabase Dashboard → Edge Functions → Secrets.
     Do not paste the real secret into chat, a ticket, a screenshot, or this file.
   - **Method / webhook type** — `POST` (ClickSend sends **form-urlencoded**, not JSON)
   - **Enabled** — on
6. There is **no headers control** (support confirmed 2026-09-09). Do not look for
   `x-internal-key`. Auth is entirely in the `?k=` query parameter.
7. **Save.**
8. Re-open the rule list and confirm there are now four rules and the three originals are
   unchanged.
9. Smoke-test with §7 — the simulator if your account exposes it, otherwise a **HELP** text
   from your own handset. Never a crew STOP.

### Webhook auth (required)

Accepted today (any one), in this order:

- `x-internal-key: <INTERNAL_SECRET>` (internal / curl tests)
- `Authorization: Bearer <INTERNAL_SECRET>`
- `Authorization: Bearer <service_role JWT>` (internal/cron style; not for ClickSend)
- `?k=<CLICKSEND_WEBHOOK_SECRET>` — **ClickSend production path**; disabled if secret unset

**ClickSend rule URL (paste into URL field only):**

```
https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-inbound-webhook?k=<SECRET>
```

The URL is credential-bearing. Do not share, screenshot, or paste into support tickets.
Details and residual platform-log risk: `10-WEBHOOK-AUTH-FALLBACK.md`.

**Health check:** Open the URL **without** `?k=` in a browser (GET). You should see:

```json
{"ok":true,"name":"clicksend-inbound-webhook"}
```

---

## 3. Kill switches (`app_settings`)

Admins can toggle these in the database (Admin SQL or future UI):

### Inbound webhook — `sms_inbound_webhook_config`

```json
{"enabled": true}
```

Set `"enabled": false` to ignore all inbound STOP/START/HELP without returning errors to ClickSend (HTTP 200 `{ "skipped": true, "reason": "disabled" }`).

### Reconciliation apply — `sms_optout_reconcile_config`

```json
{"apply_enabled": false}
```

Leave `apply_enabled` **false** until you have reviewed at least one week of diff-only runs.

**Apply mode requires BOTH:**

1. Cron or manual POST body: `{"apply": true}`
2. `sms_optout_reconcile_config.apply_enabled = true`

---

## 4. Read reconciliation diff logs

The reconcile function runs in **diff-only** mode by default.

**Manual diff (safe):**

```bash
curl -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET or service role>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response includes:

- `summary.clicksend_count` — numbers on ClickSend opt-out list
- `summary.app_opted_out_count` — employees with either flag true in app
- `clicksend_only` — on ClickSend but not opted out in app (last-4 only)
- `app_only` — opted out in app but not on ClickSend list (last-4 only)

Edge Function logs (Supabase Dashboard → Edge Functions → clicksend-optout-reconcile → Logs) echo the same summary with phone **last-4 only**.

If ClickSend credentials are missing, the function returns `"reason": "credentials_unavailable"` and does not fail hard.

---

## 5. Enable nightly reconciliation cron (when ready)

The migration creates job `clicksend-optout-reconcile` on schedule `0 9 * * *` (09:00 UTC daily) but **disabled**.

**After** `deploy-cron-auth.sh` has set the real service-role Bearer:

```sql
-- Enable the job (still diff-only until apply_enabled is true)
SELECT cron.alter_job(jobid, active := true)
FROM cron.job
WHERE jobname = 'clicksend-optout-reconcile';
```

To disable again:

```sql
SELECT cron.alter_job(jobid, active := false)
FROM cron.job
WHERE jobname = 'clicksend-optout-reconcile';
```

---

## 6. Criteria for enabling apply mode

Do **not** set `apply_enabled: true` until all of the following:

1. At least **7 days** of diff-only cron runs reviewed
2. **Every entry currently in `clicksend_only` has been individually reviewed** and either (a) confirmed as a genuine opt-out to honour, or (b) cleared from ClickSend's Opt-Out List first. See the warning below — this is the pre-condition that bites.
3. Inbound webhook verified with a **non-destructive** test first (see §7) — full STOP only on a phone you control, followed by START
4. Braden approves turning on apply

### Why criterion 2 is a hard pre-condition, not a formality

Apply mode is not a report. For every `clicksend_only` entry that resolves to an `app_users` row, reconciliation sets **both** `sms_operational_opt_out` and `sms_marketing_opt_out` to `true` on that user (`clicksend-optout-reconcile/index.ts` apply loop). Since Session 9 the send paths actually read `sms_operational_opt_out`, so those flags now have teeth: that person is immediately excluded from **safety briefing reminder, safety briefing escalation (including Tier 2 static recipients), and payroll hours SMS**.

The exclusion is logged, but nobody is notified, and the flags do not expire. Turning on apply with a stale entry on the list is how an active crew member silently stops receiving operational SMS — the exact failure mode this project exists to catch, arriving through the control built to prevent it.

**ClickSend's opt-out list is append-only in practice.** An entry from a STOP sent during testing, from a number that has since changed hands, or from the shared purchase-order app looks identical to a real withdrawal of consent. Only a human who knows the history can tell them apart, which is why this cannot be automated away.

**A known stale entry exists today:** last-4 `6644`, opted out 2026-03-04, is the developer's own handset from a test STOP. It resolves to two `app_users` rows (admin + employee) and sits on both the Tier 1 and Tier 2 escalation lists. Enabling apply before that entry is cleared from the ClickSend dashboard would opt that person out of every operational SMS path. See `12-BRADEN-TODO.md` item 1 and `13-UNREACHABLE-CREW.md` §1.

### 6a. Review query — resolve `clicksend_only` to people

ClickSend's opt-out list is not stored in Postgres, so this is a two-step: pull the current list, then resolve it against `app_users`.

**Step 1 — get the current `clicksend_only` numbers:**

```bash
curl -sS -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET or service role>" \
  -H "Content-Type: application/json" \
  -d '{}' \
| jq -r '.diff.clicksend_only[].phone_e164' | sed "s/.*/  ('&'),/"
```

That prints one SQL `VALUES` row per entry, ready to paste.

**Step 2 — resolve them (Supabase SQL editor):**

```sql
WITH clicksend_only(phone_e164) AS (
  VALUES
    -- paste step 1 output here; drop the trailing comma on the last row
    ('+18703656644')
)
SELECT
  right(regexp_replace(c.phone_e164, '\D', '', 'g'), 4)      AS last4,
  COALESCE(au.role, '(no app_users row)')                     AS role,
  au.full_name,
  au.is_active,
  au.sms_operational_opt_out                                  AS op_flag_now,
  au.sms_marketing_opt_out                                    AS mkt_flag_now,
  esc.tiers                                                   AS escalation_tiers,
  snd.sends_90d,
  snd.last_sent_at
FROM clicksend_only c
LEFT JOIN public.app_users au
  ON public.normalize_phone_to_e164(au.phone_number) = c.phone_e164
 AND au.email NOT ILIKE '%@atts.test%'
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT r.tier::text, ',' ORDER BY r.tier::text) AS tiers
  FROM public.sms_escalation_recipients r
  WHERE r.is_active
    AND public.normalize_phone_to_e164(r.phone_e164) = c.phone_e164
) esc ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS sends_90d, max(l.sent_at) AS last_sent_at
  FROM public.sms_message_log_compat l
  WHERE NOT l.is_dry_run
    AND l.sent_at > now() - interval '90 days'
    AND public.normalize_phone_to_e164(l.phone_e164) = c.phone_e164
) snd ON true
ORDER BY (au.user_id IS NULL), last4;
```

How to read each row, and what to do:

| What you see | What it means | Action before apply |
|---|---|---|
| `role` is `(no app_users row)`, `sends_90d = 0` | Purchase-order app recipient or a departed number. Apply skips it (`user_id` is null). | Nothing. Expected residue — see §8. |
| A real role, and you can account for the STOP | Genuine withdrawal of consent | Leave it. Apply will honour it, correctly. |
| A real role, and the STOP was a test or is unexplained | **Stale.** Apply will silently mute this person. | Clear the entry in the ClickSend dashboard **first**, re-run step 1, confirm it is gone. |
| `escalation_tiers` is non-empty | Also a static escalation recipient — an escalation may go out short, or to nobody | Resolve before apply; a shortened Tier 2 is the loudest failure but still a failure. |
| `sends_90d` is high | Actively messaged today; honouring this changes live behaviour immediately | Highest priority to resolve either way. |

**Do not delete a genuine opt-out entry to make this table clean.** The dated ClickSend record is the evidence of what was asked and when. Clearing is only for entries you can positively identify as not being a consent withdrawal.

Then:

```sql
UPDATE public.app_settings
SET value = jsonb_set(value, '{apply_enabled}', 'true'::jsonb)
WHERE key = 'sms_optout_reconcile_config';
```

Manual apply run:

```bash
curl -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile" \
  -H "Authorization: Bearer <INTERNAL_SECRET or service role>" \
  -H "Content-Type: application/json" \
  -d '{"apply": true}'
```

---

## 7. Verify inbound STOP (smoke test)

**Ranked options — use the safest that works:**

1. **Preferred — ClickSend Test Inbound SMS simulator** (Dashboard → SMS → Inbound / Rules → Test), if your account UI exposes it. Non-destructive; confirms the rule reaches our URL without a real carrier STOP.
2. **Braden’s own phone only:** reply **HELP** first (webhook should log `help_logged`, flip **no** opt-out flags). Only if a full path test is required, reply **STOP**, confirm flags + `sms_opt_out_events`, then immediately reply **START** so the carrier block is undone by the handset owner.
3. **Never a crew member’s phone.** A real STOP puts the number on ClickSend's opt-out list and (once the webhook is wired) sets both app flags. Only the phone's owner can clear the provider-side entry by texting START. ~~A real STOP is a permanent carrier-level block.~~ **Corrected 2026-09-09** — it is not a carrier block; the provider list does not suppress ad-hoc sends. The app flags *are* a real block, and an admin can clear those, but doing so overrides a recorded STOP and is a compliance decision, not a test cleanup step.

Check:

```sql
SELECT keyword, applied_operational, applied_marketing, user_id, received_at
FROM public.sms_opt_out_events
ORDER BY received_at DESC
LIMIT 5;

SELECT email, phone_number, sms_operational_opt_out, sms_marketing_opt_out
FROM public.app_users
WHERE phone_number LIKE '%<last4>';
```

After a deliberate STOP on a phone you control, both flags should be `true`. After START, carrier consent is restored; confirm app flags match policy before relying on apply mode.

---

## 8. First week after wiring

Every few days (SQL editor), confirm real inbound traffic:

```sql
-- Recent inbound events (expect HELP/STOP/START after crew replies)
SELECT keyword, source, applied_operational, applied_marketing,
       right(regexp_replace(phone_e164, '[^0-9]', '', 'g'), 4) AS last4,
       received_at
FROM public.sms_opt_out_events
WHERE received_at > now() - interval '7 days'
ORDER BY received_at DESC
LIMIT 50;

-- Diff-only reconcile (manual curl from §4) — note summary.clicksend_count vs app
```

**Normal:** occasional `sms_opt_out_events` rows when someone replies HELP/STOP/START; reconcile `clicksend_only` / `app_only` lists are small and explainable.

**Misconfigured rule (act on this):** **zero** inbound events over a week while crew are known to reply to SMS, or ClickSend inbound history shows replies but `sms_opt_out_events` stays empty — re-check the RTO# rule, auth header, and webhook GET health.

**Expected in the reconcile diff (not a bug):** `clicksend_only` entries with no matching employee. The opt-out list is shared with the purchase-order application, so it can contain PO recipients who are not ATTS employees and will never match `app_users`. See `01-DISCOVERY-REPORT.md` → “Shared ClickSend account”.

Also watch cron HTTP health:

```sql
SELECT * FROM public.get_recent_cron_failures(1);
```

---

## ~~Deferred: send-path filters~~ — deferral lifted 2026-09-09

~~**Not changed in Chunk 3.** `safety-briefing-reminder-sms` and `safety-briefing-escalation-sms` do not check `sms_operational_opt_out`.~~

~~**Lift this deferral when:** reconciliation diff has been stable for 7+ days; inbound webhook has processed real STOP events without false positives; product owner explicitly approves adding the filter (separate change).~~

~~Premature filtering could silently suppress safety-briefing SMS to crew who are still reachable — a worse failure than the gap being closed.~~

**Why the reasoning collapsed.** The deferral traded one risk against another: premature filtering might suppress a briefing, but the carrier was blocking opted-out numbers anyway, so the gap was tolerable. The second half was never true. ClickSend's opt-out list is only consulted for list-addressed sends, and the portal sends ad-hoc to raw numbers. There was no enforcement anywhere in the chain — not in the app, not at the carrier. The deferral was protecting against a hypothetical while a real, ongoing consent violation ran unchecked. ClickSend's documentation on this, quoted and cited, is in [`14-CLICKSEND-OPTOUT-DOCS.md`](./14-CLICKSEND-OPTOUT-DOCS.md).

**Both paths now filter** (`safety-briefing-reminder-sms`, `safety-briefing-escalation-sms`), matching `payroll-hours-reminder-sms`.

Two facts made the change low-risk on the day it landed: no `app_users` row had `sms_operational_opt_out = true`, so the filter suppressed nobody; and the inbound webhook is still not wired to a ClickSend rule, so the flag cannot change without deliberate admin action.

Safeguards that replace the deferral:

- Kill switch `app_settings.sms_send_optout_filter_config` → `{"enabled": false}` disables the filter in seconds, no redeploy.
- Every exclusion lands in `suppression_log` with `user_id` and phone last-4, plus a structured per-run count in the function logs.
- An opted-out Tier 2 static recipient is skipped with a loud warning; an emptied Tier 2 list logs at error level and still writes an audit row.

Verified against production before and after: overdue 10 / eligible 10 / field users 16, byte-identical either side of the change. Flagging one account dropped exactly that one recipient and surfaced the exclusion in the audit output.

---

## Local developer verification

```bash
bash scripts/test-sms-migration-local.sh          # Part A attribution
bash scripts/test-sms-inbound-webhook-local.sh    # Part B e2e (requires supabase start + functions serve)
npx vitest run --config tests/vitest.config.ts tests/unit/sms-opt-out-inbound.test.ts
```
