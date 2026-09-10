# ClickSend US/CA restriction — delivery evidence check

> **Read-only.** Queried `sms_delivery_receipt` + `sms_message_log` / `sms_message_log_compat`
> on project `emqqxfzahmwnehxcpxzp`, and re-ran `scripts/clicksend-audit.sh` (GET only).
> Nothing was sent. No ClickSend settings were changed.

**Dashboard claim.** ClickSend UI: *"Sending to US and CA is limited to test messaging while we review your number registration."*

**Verdict from delivery data.** That banner is **not currently blocking live US delivery** for the two REGISTERED numbers in active use. Confirmed carrier `delivered` receipts continue through **2026-09-09** (today) on both portal (`+18443781444`) and PO (`+18338612650`) traffic. There is **no inflection date** where delivery falls off a cliff.

**Queried at.** 2026-09-09 evening America/Chicago (audit JSON `generated_at` 2026-09-10T02:31:19Z).  
**Window.** Last 21 Central calendar days: **2026-08-20 → 2026-09-09**.

---

## Method notes

| Source | Role in this report |
|---|---|
| `sms_delivery_receipt` | Carrier outcome ledger (all shared-account traffic). Primary evidence. |
| `sms_message_log` | Unified live log. **Only 19 rows in prod, all dry-run, all from 2026-09-09** — not useful for the 21-day live series. |
| `sms_message_log_compat` | Portal send inventory (legacy + unified). Used to label message types and join crew. |
| `is_matched = true` | Portal sends. `false` = PO / other shared-account traffic (from `+18338612650`). |

**"no-receipt"** for portal sends in this window: **0** every day with traffic (every compat live send has a matching receipt row).  
Zero-traffic days are weekends (Aug 23/30, Sep 6) — expected for Mon–Fri safety crons.

---

## 1. Day-by-day outcomes (last 21 days, America/Chicago)

### Portal (matched receipts — operational SMS from `+18443781444`)

| Day | Sent (receipts) | Delivered | Failed | Sent-to-network | No-receipt | Delivered % |
|---|---:|---:|---:|---:|---:|---:|
| 2026-08-20 | 32 | 28 | 2 | 2 | 0 | 87.5% |
| 2026-08-21 | 33 | 29 | 2 | 2 | 0 | 87.9% |
| 2026-08-22 | 18 | 15 | 2 | 1 | 0 | 83.3% |
| 2026-08-23 | 0 | 0 | 0 | 0 | — | — |
| 2026-08-24 | 14 | 12 | 1 | 1 | 0 | 85.7% |
| 2026-08-25 | 18 | 16 | 1 | 1 | 0 | 88.9% |
| 2026-08-26 | 18 | 15 | 1 | 2 | 0 | 83.3% |
| 2026-08-27 | 36 | 32 | 2 | 2 | 0 | 88.9% |
| 2026-08-28 | 37 | 33 | 2 | 2 | 0 | 89.2% |
| 2026-08-29 | 18 | 16 | 1 | 1 | 0 | 88.9% |
| 2026-08-30 | 0 | 0 | 0 | 0 | — | — |
| 2026-08-31 | 16 | 14 | 1 | 1 | 0 | 87.5% |
| 2026-09-01 | 18 | 16 | 1 | 1 | 0 | 88.9% |
| 2026-09-02 | 19 | 10 | 0 | 9 | 0 | **52.6%** |
| 2026-09-03 | 36 | 31 | 3 | 2 | 0 | 86.1% |
| 2026-09-04 | 37 | 29 | 5 | 3 | 0 | 78.4% |
| 2026-09-05 | 19 | 16 | 2 | 1 | 0 | 84.2% |
| 2026-09-06 | 0 | 0 | 0 | 0 | — | — |
| 2026-09-07 | 20 | 17 | 2 | 1 | 0 | 85.0% |
| 2026-09-08 | 18 | 15 | 2 | 1 | 0 | 83.3% |
| 2026-09-09 | 19 | 15 | 3 | 1 | 0 | 78.9% |

**Inflection?** None that matches a US/CA send block.

- Deliveries continue every business day through **today**.
- Soft dip **2026-09-02**: delivered % fell because **9** stayed `sent_to_network` (no final fail) — recovered next day to 86%. That is lag / incomplete finalization, not a hard restriction.
- Failures stay in the **1–5 / day** band; pattern is stable absent-subscriber noise, not a sudden all-fail day.

### Full account (portal + PO unmatched)

| Day | All receipts | Delivered | Failed | Sent-to-network |
|---|---:|---:|---:|---:|
| 2026-08-20 | 47 | 36 | 9 | 2 |
| 2026-08-21 | 81 | 77 | 2 | 2 |
| 2026-08-22 | 18 | 15 | 2 | 1 |
| 2026-08-23 | 0 | 0 | 0 | 0 |
| 2026-08-24 | 40 | 38 | 1 | 1 |
| 2026-08-25 | 33 | 31 | 1 | 1 |
| 2026-08-26 | 33 | 27 | 4 | 2 |
| 2026-08-27 | 65 | 57 | 6 | 2 |
| 2026-08-28 | 37 | 33 | 2 | 2 |
| 2026-08-29 | 18 | 16 | 1 | 1 |
| 2026-08-30 | 0 | 0 | 0 | 0 |
| 2026-08-31 | 66 | 64 | 1 | 1 |
| 2026-09-01 | 65 | 61 | 3 | 1 |
| 2026-09-02 | 84 | 74 | 0 | 10 |
| 2026-09-03 | 53 | 46 | 5 | 2 |
| 2026-09-04 | 50 | 40 | 5 | 5 |
| 2026-09-05 | 59 | 56 | 2 | 1 |
| 2026-09-06 | 0 | 0 | 0 | 0 |
| 2026-09-07 | 20 | 17 | 2 | 1 |
| 2026-09-08 | 83 | 65 | 11 | 7 |
| 2026-09-09 | 34 | 30 | 3 | 1 |

PO also delivered **today** (15/15 unmatched from `+18338612650`, latest `delivered` **2026-09-09 17:47:27 UTC**).

---

## 2. By sending number (same 21-day window)

| From | Role | Matched? | Receipts | Delivered | Failed | Sent-to-network | Delivered % | Last delivery_status_at |
|---|---|---|---:|---:|---:|---:|---:|---|
| **`+18443781444`** (RTO #) | Portal operational | yes | 426 | 359 | 33 | 34 | **84.3%** | 2026-09-09 16:00:04 UTC |
| **`+18338612650`** (PO #) | Purchase-order app | no | 460 | 424 | 27 | 9 | **92.2%** | 2026-09-09 17:47:27 UTC |
| **`+18335183807`** (Safety #) | — | — | **0** | — | — | — | — | no traffic in window |

**Restriction scope.** If the banner were enforcing a hard US/CA test-only lock on the whole account, **both** active numbers would stop delivering. They have not. The restriction (if real) is **not** hitting the two REGISTERED numbers in production use. Safety# has no sends yet (still `REGISTRATION_INITIATED`).

API field `usage_restriction` on all three numbers: **`null`**.

---

## 3. Most recent confirmed delivery to a real crew member

| Field | Value |
|---|---|
| **Timestamp** | **2026-09-09 11:00:04 America/Chicago** (`2026-09-09 16:00:04+00`) |
| **To last-4** | **9951** (Steve Curtis, `steve@alltts.com`) |
| **Message type** | `safety_briefing_escalation_t2` |
| **From** | `+18443781444` |
| **Carrier status** | `delivered` |

Same second also delivered T2 to last-4 **0398** (Shane Fludy) and **6644** (Braden). That single fact: **live operational SMS is working right now.**

Latest PO-side confirmed delivery (shared account, not portal): **2026-09-09 17:47:27 UTC** (12:47 PM Central).

---

## 4. Carrier error codes on failures (21-day window)

| From | Matched | Error code | Provider status text | Count | First → last |
|---|---|---|---|---:|---|
| `+18443781444` | portal | **12** | Absent Subscriber. Phone is out of range or switched off… | **33** | 2026-08-20 → **2026-09-09** |
| `+18338612650` | PO | **12** | Absent Subscriber. Phone is out of range or switched off… | **27** | 2026-08-20 → 2026-09-08 |

`delivery_error_text` on all of these: `Unknown error` (ClickSend packaging; unchanged).

**New restriction signature?** **No.** Only code **12** appears. Historical pattern in this account has been **12 (absent subscriber)** and previously **15 (rejected by network)** — see `18-PO-APP-DELIVERY.md`. Code **15** does **not** appear in this 21-day window. There are **no** new codes that would indicate a registration / test-mode block (no “unregistered”, “campaign rejected”, “filtered”, etc.).

---

## 5. Safety-briefing runs — yesterday & today

Source: `sms_escalation_send_log` (Tier 0 = reminder; Tier 1/2 = escalation) + receipt join via `sms_message_log_compat`.

### Cron fire + recipients

| Date (Central) | Tier | Cron fired? | `sent_at` (UTC) | Recipients | Overdue | `success` |
|---|---:|---|---|---:|---:|---|
| 2026-09-08 | 0 (reminder) | **yes** | 10:40:05 | 14 | 14 | true |
| 2026-09-08 | 1 | **yes** | 16:00:03 | 1 | 13 | true |
| 2026-09-08 | 2 | **yes** | 16:00:04 | 3 | 13 | true |
| 2026-09-09 | 0 (reminder) | **yes** | 10:40:03 | 15 | 15 | true |
| 2026-09-09 | 1 | **yes** | 16:00:03 | 1 | 11 | true |
| 2026-09-09 | 2 | **yes** | 16:00:04 | 3 | 11 | true |

### Delivery confirmations (compat × receipt)

| Day | Message type | Logged sends | Delivered | Failed | Sent-to-network | No-receipt |
|---|---|---:|---:|---:|---:|---:|
| 2026-09-08 | reminder | 15 | 12 | 2 | 1 | 0 |
| 2026-09-08 | escalation_t1 | 1 | 1 | 0 | 0 | 0 |
| 2026-09-08 | escalation_t2 | 4* | 4* | 0 | 0 | 0 |
| 2026-09-09 | reminder | 16 | 12 | 3 | 1 | 0 |
| 2026-09-09 | escalation_t1 | 1 | 1 | 0 | 0 | 0 |
| 2026-09-09 | escalation_t2 | 4* | 4* | 0 | 0 | 0 |

\*T2 compat row count can exceed escalation `recipient_count` (3) when the same phone maps to more than one `app_users` row (known Braden duplicate). Receipts confirm **three distinct last-4s delivered** on T2 today: 6644, 9951, 0398.

**Bottom line for briefing SMS:** both days’ crons ran; majority of reminders got `delivered`; **all** escalation messages today got `delivered`. Failures on reminders are code **12** only.

---

## 6. ClickSend number registration status (re-audit)

Re-ran `./scripts/clicksend-audit.sh` → `docs/sms-upgrade/clicksend-audit-2026-09-09.json`  
(`generated_at`: 2026-09-10T02:31:19.886410Z). Compared to earlier same-day verify snapshot.

| Number | Notes | Status (prior verify ~16:43Z) | Status (this audit) | Changed? |
|---|---|---|---|---|
| `+18338612650` | PO # | **REGISTERED** | **REGISTERED** | no |
| `+18443781444` | RTO # (portal default) | **REGISTERED** | **REGISTERED** | no |
| `+18335183807` | Safety # | **REGISTRATION_INITIATED** | **REGISTRATION_INITIATED** | no |

Other two have **not** changed from REGISTERED. Safety# remains Decision Pending / registration in progress. All three: `usage_restriction = null`.

---

## Conclusion

1. **No delivery cliff** in the last 21 days attributable to a US/CA test-only lockdown.
2. **Both active REGISTERED numbers still deliver** to real US handsets today.
3. **Most recent portal confirmed delivery:** 2026-09-09 11:00:04 Central, last-4 **9951**, `safety_briefing_escalation_t2`.
4. Failures remain the historical **absent subscriber (12)** pattern — not a new restriction error.
5. Safety briefing crons for Sep 8 and Sep 9 **did fire**; deliveries confirmed.
6. Registration statuses unchanged: two REGISTERED, Safety# still REGISTRATION_INITIATED.

The dashboard banner may reflect a review / compliance workflow (especially for the in-progress Safety# registration), but **carrier receipts contradict a present hard block on production sends from the REGISTERED numbers.**

---

## 7. Failure attribution (portal, same 21-day window)

> Read-only follow-up. Hypothesis: daily 1–3 failures are mostly the two known-bad last-4s
> **`4421`** and **`6286`** (`13-UNREACHABLE-CREW.md`). Confirmed.

### Failed receipts by last-4 (ranked)

| Rank | Last-4 | Failed count | Distinct days | First fail → last fail |
|---:|---|---:|---:|---|
| 1 | **4421** | **23** | 17 | 2026-08-20 → 2026-09-09 |
| 2 | **6286** | **6** | 6 | 2026-09-03 → 2026-09-09 |
| 3 | 0665 | 2 | 1 | 2026-09-04 only |
| 4 | 1454 | 1 | 1 | 2026-09-09 only |
| 5 | 9829 | 1 | 1 | 2026-08-22 only |
| | **Total** | **33** | | |

**Share belonging to 4421 + 6286:** 23 + 6 = **29 / 33 = 87.9%** of portal failures.

**Fail-every-send check (same window):**

| Last-4 | Receipts | Delivered | Failed | Sent-to-network |
|---|---:|---:|---:|---:|
| 4421 | 24 | **0** | 23 | 1 (09-02 only) |
| 6286 | 6 | **0** | 6 | 0 |

Hypothesis holds: both numbers have **zero** deliveries; 6286 fails every attempt; 4421 fails every attempt except one 09-02 `sent_to_network` that never finalized to delivered.

### Other numbers >2 failures?

**None.** No last-4 outside `{4421, 6286}` appears more than twice. Nothing new for `13-UNREACHABLE-CREW.md` from the failure series. (One-off / two-off: 0665×2, 1454×1, 9829×1 — transient, not chronic.)

### Projected delivery rate if 4421 & 6286 were corrected

Method: keep all receipts; remove only the **29** failures attributed to those two numbers from the denominator (as if those attempts were not failed outcomes / numbers were fixed and no longer polluting the rate).

| Metric | Value |
|---|---|
| Portal receipts (21d) | 426 |
| Delivered | 359 |
| Failed | 33 (of which 29 = 4421/6286) |
| Sent-to-network | 34 |
| **Observed delivery rate** | **359 / 426 = 84.27%** |
| **Excluding 4421+6286 failures** | **359 / 397 = 90.43%** |

Side by side: **84.3% → 90.4%** (+6.2 pp) if those two known-bad numbers stop failing.

(If instead all 30 receipts to those numbers were dropped from the sample: 359 / 396 = 90.7% — nearly the same.)

### Sent-to-network (no final receipt) by last-4

| Last-4 | STN count | Distinct days | Of which on 2026-09-02 |
|---|---:|---:|---:|
| **1952** | **24** | 18 | 1 |
| 6644 | 2 | 2 | 1 |
| 0665 | 1 | 1 | 1 |
| 1454 | 1 | 1 | 1 |
| 4421 | 1 | 1 | 1 |
| 5979 | 1 | 1 | 1 |
| 7499 | 1 | 1 | 1 |
| 9499 | 1 | 1 | 1 |
| 9829 | 1 | 1 | 1 |
| 9951 | 1 | 1 | 0 |
| **Total** | **34** | | **9** |

**09-02 spike (9 STN):** nine **different** last-4s, all timestamped `2026-09-02 10:40:02+00` (reminder batch). That is **general carrier lag / incomplete finalization on that morning’s blast**, not a cluster on one bad number.

**Chronic STN:** last-4 **1952** accounts for **24 / 34 (70.6%)** of all STN rows and appears on **18** distinct days with **zero** `delivered` and **zero** `failed` in this window — a separate “never finalizes” pattern, not a failure. Not counted in the failure attribution above; already distinct from 4421/6286. Worth a follow-up note against unreachable/crew hygiene if not already tracked as STN-only.
)
