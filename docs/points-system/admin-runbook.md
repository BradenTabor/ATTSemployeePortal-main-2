# Points System — Admin Runbook

Plain-language guide for ATTS admins and supervisors. Describes the system **as built** in the employee portal (June 2026).

For technical architecture, RPCs, and migrations, see [architecture.md](./architecture.md).

---

## Two numbers employees see

| What | Meaning | Reduced by store spending? |
|------|---------|----------------------------|
| **Wallet balance** | Total spendable points from all earning activity | **Yes** — redeeming holds points immediately |
| **Raffle entries** (this month) | Briefing-claim days + briefing streak **bonus entries** | **No** — spending does not change raffle entries |

Compliance points, near-miss awards, certifications, and manual recognition all add to the **wallet**. The **monthly raffle drawing** currently uses **daily safety briefing claims** (plus briefing streak bonuses), not the full wallet total.

---

## How points are earned

Default values below match seeded `app_settings.reward_points_config` and `point_rules`. Admins can change briefing/compliance values under **Admin → Safety Settings** (`/admin/safety-settings`). Near-miss and certification amounts live in the `point_rules` table (admin-readable; changes require a developer migration or direct DB edit today).

### Daily safety

| Activity | Default points | Where it shows |
|----------|----------------|----------------|
| **Safety briefing claim** | 1 | Wallet; also counts as one raffle entry for that day |
| **Full compliance** (DVIR + equipment inspection + JSA same day) | 5 | Wallet only |
| **Partial compliance** (at least one of those forms) | 2 | Wallet only |
| **Compliance streak bonus** | +10 added on top of full compliance | Wallet only — awarded when an employee hits **5+ consecutive weekdays** of full compliance (configurable via `streak_min_days`) |

**Briefing claim window:** default **5:00–8:00 AM Central**, weekdays. Configurable in Safety Settings.

**Compliance awards:** the daily compliance cron (`admin-compliance-cron`) runs on weekdays and writes `compliance_rewards` rows; the ledger syncs automatically.

**Two different “streaks”:**

- **Briefing streak** → extra **raffle entries** (not wallet points): +2 entries at 5 consecutive briefing-claim days, +5 more at 10 days, +15 more if they claim every announcement day in the month.
- **Compliance streak** → extra **wallet points** (+10) on days when full compliance continues for `streak_min_days` or more.

### Safety reporting

| Activity | Points | Limits |
|----------|--------|--------|
| **Near-miss filed** | 10 | Up to **2 per reporter per calendar day** (Central time) |
| **Verified corrective action** on a near-miss | 15 | **One bonus per incident** (first verified CAPA only) |

Near-miss must have a reporter (`reported_by`) to earn points.

### Certifications

| Activity | Points |
|----------|--------|
| **Certification passed** (record becomes active) | 20 |
| **Early renewal** (renew while still active and unexpired) | 10 |

Practical-eval certifications require the practical evaluation before points award.

### Manual recognition

Admins and **granted awarders** can give discretionary points (see below). Manual awards add to the employee’s **wallet** and are audited.

---

## Manual awards

### Who can award

- **Admins** — always; no per-award cap or monthly budget.
- **Granted awarders** — users with an active row in `point_awarder_grants` (default cap **25** per award, **500** per calendar month Central).

Granted supervisors also get a floating **Award Points** button in the app (bottom-right on mobile/desktop).

### Admin tasks

| Task | Where |
|------|--------|
| Grant / edit / revoke award permission | **Admin → Manual Awards** (`/admin/manual-awards`) → **Manage awarders** |
| Review audit trail | Same page → **Audit log** tab |
| Award points (admin) | **Admin → Rewards** or floating **Award Points** button |
| Award points (granted non-admin) | Floating **Award Points** button only |

When awarding:

1. Pick recipient (cannot award yourself).
2. Enter amount, **category** (maintenance, good performance, safety catch, attendance, peer recognition, other), and **reason** (required).
3. Submit — the system records `awarded_by`, reason, and a unique request id (idempotent retries won’t double-award).

Optional: the app calls `notify_manual_award_recipient` so the employee gets a push/in-app notice.

### Auditing

Every manual award is a row in `point_transactions` (`source = manual_award`) with reason, category, awarder, and timestamp. Filter the audit log by awarder, recipient, category, or date range. Export to CSV from the audit tab.

---

## Monthly safety raffle

### How entries work

Each **briefing claim** in a month = **1 raffle entry** for that employee.

**Briefing streak bonuses** add extra entries (not wallet points):

- 5 consecutive claim days → +2 entries  
- 10 consecutive claim days → +5 more entries  
- Claimed every announcement day in the month → +15 more entries  

Employees see entries and odds on **Safety Rewards** (`/safety-rewards`) and **My Points** (`/my-points`).

**Spending points in the store does not reduce raffle entries.**

### Admin tasks

| Task | Where |
|------|--------|
| Set up this month’s prizes (names, descriptions, images) | **Admin → Safety Rewards** (`/admin/safety-rewards`) |
| Run the drawing (or re-draw) | Same page — **Run drawing** on the month card |
| View past winners | Safety Rewards page (employees) or admin month cards |

**Before drawing:** configure at least the grand prize for that month.

**Drawing mechanics:** the `run-monthly-drawing` edge function builds a weighted pool from briefing claims + streak bonuses, picks grand prize and up to two runner-ups (no duplicate winners), saves to `monthly_reward_drawings`, and emails configured admin recipients.

**Automated run:** pg_cron triggers the drawing on the **last calendar day of the month** (Chicago time). Admins can also run manually anytime (use **Re-draw** to replace an existing result).

Prize images use the shared **`safety-rewards`** storage bucket (same as catalog images).

---

## Redemption store

### Stocking the catalog

**Admin → Reward Catalog** (`/admin/reward-catalog`)

| Field | Guidance |
|-------|----------|
| Name / description | Shown in the employee store |
| Point cost | Must be > 0. **Not retroactive** — each redemption snapshots `point_cost` at request time |
| Stock | Blank = unlimited. Integer = tracked inventory |
| Category | apparel, gear, gift_card, other |
| Sort order | Lower numbers appear first |
| Active | Inactive items hidden from `/rewards-store` |
| Image | Optional; uploaded to `safety-rewards` bucket under `catalog/` |

**Deactivate vs delete**

- **Deactivate** (`is_active = false`) — preferred way to retire an item. History preserved; item hidden from store.
- **Delete** — only when **zero redemptions** reference the item. If any redemption exists, delete is blocked (database protects history).

Price or image changes apply to **future** redemptions only.

### Fulfillment queue

**Admin → Redemption Fulfillment** (`/admin/redemption-fulfillment`)

When an employee redeems:

1. Points are **held immediately** (deducted from wallet).
2. Request status = **pending**.
3. **Admins are notified** (push/in-app, role fan-out).

Admin actions:

| Action | Effect |
|--------|--------|
| **Fulfill** | Marks complete; hold becomes final spend. Employee notified (“your item is ready”). |
| **Deny** | Refunds points to wallet. Employee notified (message mentions refund). Stock restored if tracked. |

Employees can **cancel** their own pending request from the Rewards Store (same refund path as deny; no admin notification).

---

## Notifications

All use the existing `admin_notice` notification category and dispatch through `notification_events` → push/in-app.

| Event | Who is notified | When |
|-------|-----------------|------|
| New pending redemption | **All admins** (role fan-out) | Employee completes redeem |
| Redemption fulfilled | **Requesting employee** | Admin fulfills |
| Redemption denied | **Requesting employee** | Admin denies (copy mentions refund) |
| Redemption canceled | *(none)* | Employee cancels own pending request |
| Manual award | **Recipient** | Awarder submits (via `notify_manual_award_recipient`) |

Notification failures are logged but **never roll back** the underlying points action.

---

## If something looks wrong

| Symptom | Where to look |
|---------|----------------|
| “Wrong balance” | **My Points** → wallet + activity feed. Sum of activity should match balance. |
| “Missing earning type” | **My Points** → breakdown by source. |
| “Redemption stuck” | **My Points** → pending block; admin → **Redemption Fulfillment** queue. |
| “Manual award dispute” | **Manual Awards → Audit log** (who, whom, amount, reason, when). |
| “Raffle entries don’t match expectations” | **Safety Rewards** / **My Points** → entries are **briefing-based**, not wallet total. |
| “Can’t upload catalog image” | Must be admin; storage policy enforces at API level. |
| “Employee can’t redeem” | Check wallet ≥ item cost, item active, stock > 0 if tracked. |

Employee self-service: **`/my-points`** (balance, breakdown, activity, pending redemptions) and **`/rewards-store`** (browse, redeem, cancel pending).

---

## Related increment notes

Detailed increment write-ups (still accurate for their scope):

- [my-points-page.md](./my-points-page.md)
- [redemption-store-db.md](./redemption-store-db.md)
- [catalog-management.md](./catalog-management.md)
- [redemption-notifications.md](./redemption-notifications.md)
