# Orphaned manager_id investigation — `06aafe0d-…`

**Status:** Finding filed 2026-09-10. **Do not reassign reporting lines from an agent session** —
that is Braden's call. This note exists because Session 14 flagged the UUID as dangling; a
re-check overturned the serious half of that claim.

**Internal-only.** Contains last-4 phone digits and roles, not full names of the 14 (except the
resolved manager, who is named because the whole finding turns on who he is).

---

## The UUID

```
06aafe0d-c620-4e25-b73d-72645a14d5ef
```

## Prior claim (Session 14) — overturned in part

Session 14 recorded: this UUID "exists in neither `app_users` nor `auth.users`," and therefore
Tier 1 escalation for 14 people "has nowhere to go."

**Re-check (service-role, 2026-09-10):**

| Lookup | Count |
|---|---:|
| `app_users.id = 06aafe0d-…` | **1** |
| `app_users.user_id = 06aafe0d-…` | 0 |
| `auth.users.id = 06aafe0d-…` | 0 |
| `auth.users.id = <that row's user_id>` | **1** |
| `app_users.manager_id = 06aafe0d-…` | **14** |

The UUID is **`app_users.id`**, not an Auth uid. Checking `auth.users` (or `app_users.user_id`)
for it returns empty and looks like a ghost. Checking `app_users.id` resolves it.

### Who it resolves to

| | |
|---|---|
| **Name** | Steve Curtis |
| **Role / status** | `general_foreman`, `active` |
| **Phone (last-4)** | `9951` (`+18702809951`) |
| **`app_users.id`** | `06aafe0d-c620-4e25-b73d-72645a14d5ef` |
| **`app_users.user_id` (Auth)** | `6246824c-ac2d-4a41-b862-73bddc1a0f5e` — row exists in `auth.users` |
| **Account created** | 2025-12-23 |

So this is **not** an unresolvable manager reference. It is a normal FK to a live
general-foreman row. The scary reading was a **column mix-up** (`id` vs `user_id` /
Auth id), the same class of pitfall as `last_sign_in_at` ≠ "last used the app."

---

## The 14 accounts that point at him

All non-test. All `status = active` as of 2026-09-10. Last-4 only.

| Role | last-4 | Account created | `updated_at` (UTC) |
|---|---|---|---|
| employee | `0665` | 2026-08-19 | 2026-09-02 |
| employee | `1454` | 2025-12-30 | 2026-06-12 |
| employee | `1952` | 2025-12-30 | 2026-07-12 |
| employee | `2057` | 2026-02-04 | 2026-08-17 |
| employee | `4421` | 2026-01-12 | 2026-06-19 |
| employee | `6286` | 2026-08-31 | 2026-09-02 |
| employee | `7499` | 2026-08-17 | 2026-09-02 |
| employee | `8977` | 2026-01-09 | 2026-06-09 |
| employee | `9499` | 2026-01-17 | 2026-07-17 |
| employee | `9829` | 2026-08-19 | 2026-09-02 |
| foreman | `4249` | 2026-01-07 | 2026-06-10 |
| foreman | `4325` | 2026-01-07 | 2026-06-11 |
| mechanic | `3619` | 2025-12-10 | 2026-03-04 |
| mechanic | `5979` | 2025-11-22 | 2026-03-04 |

**When was `manager_id` set?** Not cheaply determinable from current columns alone — there is
no audit trail of who assigned the FK. Earliest of these accounts is 2025-11-22; Steve's own
row is 2025-12-23; `updated_at` on the 14 spans 2026-03-04 … 2026-09-02 and mostly reflects
unrelated profile edits. Four of the 14 share a 2026-09-02 update cluster (new-hire batch
including `6286`). Treat assignment time as **unknown** unless Braden remembers a bulk assign.

---

## D.2 — What escalation does today

Source: `supabase/functions/safety-briefing-escalation-sms/index.ts`
(comment at top of file + ~L522–564).

1. Collect distinct `manager_id` values from overdue D1 crew.
2. `SELECT … FROM app_users WHERE id IN (managerIds)` and build `managerPhoneMap` from
   E.164-normalised `phone_number`.
3. For each overdue user:
   - no `manager_id` → orphan, reason **`"no manager"`** → Tier 2
   - `manager_id` present but no resolvable phone in the map → orphan, reason
     **`"no manager phone"`** → Tier 2
   - otherwise → group under that manager for **Tier 1** SMS

**For these 14 today:** the manager row exists, has a phone, and normalises to E.164. They
take the **Tier 1** path. Escalation texts Steve Curtis. It does **not** silently drop, does
**not** error, and does **not** route them to Tier 2 orphan handling on account of this UUID.

### Has `orphaned_user_ids` been catching these 14?

`sms_escalation_send_log.orphaned_user_ids` is the existing mechanism. Re-check of log rows
since 2026-08-01 for these 14's `user_id`s:

- A few (`7499`, `9829`, and one other historically) appear with reason **`"no manager"`**
  between **2026-08-24 and 2026-09-02** — i.e. they had a **null** `manager_id` on those
  overdue days, then were later pointed at Steve. That is ordinary orphan→Tier 2 behaviour.
- There are **no** recent hits with reason `"no manager phone"` for this manager UUID, which
  is what an unresolvable / phoneless manager would produce.
- **While `manager_id = 06aafe0d-…` is set, orphan handling is not "catching" these 14 for a
  missing manager** — because the manager resolves.

---

## Residual risk (real, but narrower than Session 14 stated)

1. **Reporting-line correctness, not resolvability.** Fourteen people across employee /
   foreman / mechanic all report to one general foreman in the data model. Whether that is
   organisationally right is Braden's call — code cannot decide it.
2. **`id` vs `user_id` confusion will recur.** Any future "does this manager exist?" check
   must query `app_users.id` (the FK target), not `auth.users.id` / `app_users.user_id`.
3. **Foremen reporting to a GF** may be intentional; mechanics and the SMS-unreachable
   employees (`4421`, `6286`) sitting on the same FK is the part worth a human glance.

---

## Recommended fix direction (do not implement here)

- **Do not** null out or bulk-reassign these 14 from an agent session.
- Ask Braden: *"Are these 14 correctly under Steve Curtis, or was this a bulk-assign
  placeholder?"* If yes → close the ticket; the escalation path already works. If no → he
  picks the right `manager_id` values (or clears them so Tier 2 orphan handling covers them
  deliberately).
- Optionally add a cheap admin integrity query / advisor: `manager_id IS NOT NULL AND NOT
  EXISTS (SELECT 1 FROM app_users m WHERE m.id = app_users.manager_id)` — that would have
  returned **zero** rows for this UUID (because the row exists), which is the correct
  answer and would have prevented the false alarm. A second check for
  "manager has no phone" is the one that feeds Tier 2.

**No code change. No data change. No SMS sent.**
