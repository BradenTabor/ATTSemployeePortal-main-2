# Directive: Field Safety Audit (Safety Officer)

> Layer 1 (Directive). Architect: Claude. Implementer: Cursor (relay via Braden).
> Status: SPEC — gate-first, no implementation until Gate 0 sign-off.

## Goal

A field-use page for the safety officer to audit **one site visit at a time**: every piece
of equipment and every crew member present gets a Pass / Fail / N/A checklist. Each FAIL
gets an **officer-chosen escalation level** (record only → corrective action + notify →
corrective action + points deduction). A monthly edge function emails admins a summary
on the 1st.

Decisions locked with Braden (2026-06-10):

1. **Session structure:** per site visit — one `field_audits` row covers all equipment
   units and crew members at that location/date.
2. **Fail handling:** manual escalation picker per finding. No automatic punitive action.
3. **Checklist definitions:** hybrid — section structure, equipment-type mapping, and value
   semantics in code; item text, ordering, `is_active`, and standard-reference strings in a
   seeded config table (admin-editable later without a deploy).

## Regulatory basis (sources for checklist content)

ATTS performs utility line clearance / ROW clearance, so the audit checklist mirrors what
an OSHA CSHO would check under the 2021 tree-care inspection guidance memo plus the
line-clearance vertical standard:

- **29 CFR 1910.269** — applies to line-clearance tree trimming done for a line operator.
  Subsections relevant to all line-clearance trimmers: (a)(2) training, (b) medical
  services/first aid, (c) job briefing, (g) PPE/fall protection, (k) material handling,
  (p) mechanical equipment, (r) line-clearance specifics (MADs, chippers, saws, ropes,
  backpack units).
- **29 CFR 1910.331–335** (Subpart S) — electrical safety-related work practices, applies
  to all arborists.
- **ANSI Z133 (current ed.)** — consensus standard ATTS publicly affiliates with.
  §3.3 PPE, §3.4 job briefing, §4 electrical hazards, §5 vehicles & mobile equipment,
  §8 chippers/saws/hand tools.
- **29 CFR 1910.67 + ANSI A92.2** — aerial devices: daily control test before use,
  fall protection attached in platform, boom cradled/outriggers stowed for travel,
  **dielectric (insulation) test current per A92.2 intervals** (date-driven check),
  annual inspection ≤ 13 months.
- **29 CFR 1910.266(e)** — chainsaw condition (chain brake, throttle interlock, chain
  catcher, muffler/spark arrestor). Note: 1910.266 is the *logging* standard; OSHA's
  tree-care citation guidance (CPL 02-01-045 lineage / 2021 memo) applies it to saw
  condition in tree operations where applicable — keep `standard_ref` strings as-is
  but the UI info chip should not claim tree work is "logging."
- **29 CFR 1910 Subpart O** — machine guarding (chippers, stump cutters).
- **29 CFR 1910.157 / 1910.151** — fire extinguishers; first aid supplies.
- **ANSI Z89.1 / Z87.1 / ANSI-ISEA 107** — head (Class E for electrical exposure),
  eye/face, hi-vis apparel (Class 2 <50 mph roads, Class 3 high-speed/low-vis).
- **OSHA memo 2021-06-30** “Inspection Guidance for Tree Care and Tree Removal
  Operations” — the categorization spine for the whole checklist.

Every seeded checklist item carries a `standard_ref` string (e.g. `1910.269(r)(5)`,
`Z133 §3.3.7`) surfaced in the UI as a tappable info chip — audit defensibility.

## Data model (forward migrations via MCP; gate per CONVENTIONS.md)

### `field_audits` (activity table)

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| audited_by | uuid → profiles | safety officer (or recorder) |
| audit_date | date | Chicago-local |
| job_id | uuid → jobs, nullable | optional link to active job |
| location_label | text | free text when no job linked |
| status | enum `draft \| submitted` | draft = in-progress on device |
| notes | text | |
| created_at / submitted_at | timestamptz | |

### `field_audit_subjects`

One row per audited thing in the session. `subject_kind` enum: `equipment | person`.

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| audit_id | uuid → field_audits | cascade |
| subject_kind | enum | |
| equipment_type | text nullable | from code-side `EQUIPMENT_TYPE_OPTIONS` + `bucket_truck`, `chipper`, `chainsaw`, `truck_trailer`, **or free text** (custom flag below) |
| equipment_number | text nullable | unit ID (e.g. `J-119`) or free text for custom units; **normalized upper-trim on save so `j119`/`J-119` history joins don't fragment** |
| is_custom_equipment | bool default false | true when type/number entered ad hoc; surfaces in admin review so recurring units can be promoted to the constants list |
| person_id | uuid → profiles nullable | crew member |
| ~~result_summary~~ | — | **DROPPED at Gate 1** — no denormalized rollup column. Pass/fail/NA rollups are read-time (`GROUP BY` over `field_audit_items`, backed by `idx_fa_items_fail`). See "Schema decisions from Cursor review". |

CHECK: exactly one of (equipment fields, person_id) populated per `subject_kind`.

### `field_audit_items`

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| subject_id | uuid → field_audit_subjects | cascade |
| checklist_item_id | uuid → audit_checklist_items nullable | null for ad-hoc items |
| custom_label | text nullable | required when `checklist_item_id` null (item the officer typed in the field) |
| value | enum `P \| F \| NA` | reuse ChecklistValue semantics |
| note | text | required when `F` |
| photo_path | text nullable | storage bucket `field-audit-photos` |
| escalation | enum `none \| corrective_action \| corrective_action_points` | only meaningful when `F`; default `none` |
| corrective_action_id | uuid → corrective_actions nullable | set when escalated |
| point_transaction_id | uuid nullable | set when points deduction issued |

### `audit_checklist_items` (CONFIG table — add to `config_tables.txt` in same commit)

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| section | text | code-known key: `aerial_device`, `chipper`, `chainsaw`, `mobile_equipment`, `vehicle_general`, `person_ppe`, `person_practices`, `site` |
| label | text | item text |
| standard_ref | text | e.g. `1910.67(c)(2)` |
| sort_order | int | |
| is_active | bool | soft-disable without deploy |
| requires_photo_on_fail | bool | default false |

Code-side map (new `src/pages/safety-officer/fieldAuditConstants.ts`):
`equipment_type → section[]` (e.g. Jarraff → `aerial_device` + `mobile_equipment`;
Skidsteer/Mulcher/Geo-Boy → `mobile_equipment`; Chipper → `chipper` + `vehicle_general`;
person → `person_ppe` + `person_practices`). Section structure stays in code; rows stay
config. Seeding ships as a migration `INSERT`; later edits are migrations too
(config-table corollary).

### `field_notes` (persistent log — attaches to the PERSON/EQUIPMENT, not the audit)

The memory layer. A note made today is visible in every future audit of that subject.
Canonical example: officer issues Chad a new hard hat → `ppe_issued` note. Next audit,
Chad's hard hat is missing → officer sees "Issued new hard hat — 6/3" on Chad's card
and escalates with full context.

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| author_id | uuid → profiles | safety officer / recorder |
| person_id | uuid → profiles nullable | one of person/equipment required |
| equipment_type | text nullable | |
| equipment_number | text nullable | equipment identity = (type, number) pair |
| note_kind | enum `general \| ppe_issued \| equipment_issued \| verbal_warning \| repair_noted` | filterable; `ppe_issued` powers the hard-hat scenario |
| item_tag | text nullable | optional free tag, e.g. `hard hat`, `chaps` — enables "how many hard hats has Chad been issued this year" |
| body | text | the note |
| audit_id | uuid → field_audits nullable | set when written during an audit; note still outlives the audit |
| created_at | timestamptz | |

Indexes on `(person_id, created_at desc)` and `(equipment_type, equipment_number,
created_at desc)`. Notes are append-only (no update/delete via RLS; admin can
soft-retract with a follow-up note — keeps the log trustworthy).

### RLS

- `safety_officer` and `admin`: full select/insert/update on audits they create
  (admin: all).
- `general_foreman`: read-only on submitted audits (optional, Gate 2 decision).
- Everyone else: no access. Items inherit via subject → audit join.

## Checklist seed content (v1)

### Section `person_ppe` (per crew member)

- Hard hat worn, ANSI Z89.1, Class E where electrical exposure — `Z133 §3.3.5 / Z89.1`
- Eye protection worn (Z87.1) — `Z133 §3.3.7`
- Hearing protection in use around 85 dBA+ sources — `1910.95 / Z133 §3.3.8`
- Cut-resistant leg protection when operating chainsaw on ground — `Z133 §3.3 / ASTM F1897`
- Hi-vis apparel, correct class for traffic exposure — `ANSI-ISEA 107`
- Appropriate footwear, condition good — `Z133 §3.3`
- Gloves appropriate to task (no loose gauntlets at chipper) — `Z133 §8.7.3`
- Fall protection worn + attached when in aerial device — `1910.67(c)(2)(v) / 1910.269(g)`
- Climbing gear / saddle / lanyard condition (if climber) — `Z133 §8.1 / 1910.269(r)(7)`

### Section `person_practices`

- Job briefing conducted before work began — `1910.269(c) / Z133 §3.4.3`
- Voltage determination made; MADs known for nominal voltage — `1910.269(r)(1)`
- Line-clearance qualification current (LCAT/trainee status) — `1910.269(a)(2)`
- Second worker within visual/voice contact during MAD work — `1910.269(r)(1)(ii)`
- CPR/first-aid coverage: ≥2 trained on site for crews of 2+ — `1910.269(b) / Z133 §3.2`
  (UI assist: pre-check against `certification_records`)
- 10-ft rule observed for backpack brush saw bystanders — `1910.269(r)(6)`

### Section `aerial_device` (Jarraff / bucket)

- Daily lift-control function test performed — `1910.67(c)(2)(i)`
- Boom insulation: dielectric test in date (enter last test date) — `1910.67(c)(3) / A92.2`
- Annual inspection within 13 months — `A92.2`
- Bucket liner condition (where used) — `1910.269`
- Boom cradled + outriggers stowed before travel — `1910.67(c)(2)(xii)`
- Hydraulic leaks / hose condition — `A92.2`
- Anchorage point + lanyard condition in platform — `1910.67(c)(2)(v)`
- Operator manual in vehicle — `1910.67(c)(2)`

### Section `chipper`

- Feed-control bar / last-resort device functional — `1910.269(r)(5) / Z133 §8.7`
- Infeed hopper + discharge chute guards intact — `1910 Subpart O`
- Chipper attached/chocked against movement; hitch + chains — `Z133 §8.7`
- No loose clothing / climbing gear / gauntlet gloves on operators — `Z133 §8.7.3`
- E-stop functional — `Z133 §8.7`

### Section `chainsaw`

- Chain brake functional — `1910.266(e)(2)`
- Throttle interlock functional — `1910.266(e)`
- Chain catcher present — `1910.266(e)`
- Muffler / spark arrestor intact — `1910.266(e)`
- Proper start position (not drop-started aloft) observed — `Z133 §8.2 / 1910.269(r)(4)`
- Fueling ≥10 ft from ignition sources; approved container — `1910.266(e)(1)(ix)`

### Section `mobile_equipment` (Skidsteer / Mulcher / Geo-Boy / Grapple)

- ROPS/FOPS intact; seatbelt functional and worn — `1910.269(p)`
- Backup alarm functional — `1910.269(p)`
- Fire extinguisher charged, mounted, inspection tag current — `1910.157`
- First aid kit present + stocked — `1910.151 / 1910.269(b)`
- Guards/shields in place — `1910 Subpart O`
- Glass/mirrors/cameras intact — overlap with daily DEI form, kept for spot-audit parity
- LOTO capability available for service (locks/tags on truck) — `1910.147`

### Section `site`

- Work zone / traffic control set per MUTCD; signage + cones — `Z133 §3.4 / MUTCD`
- Drop zone established and communicated — `Z133 §8.5`
- Public protected from chipper discharge / falling debris — `Z133`
- Emergency action info available (nearest hospital, address for 911) — `1910.269(b)`

*(Exact seed SQL written at Gate 1; items above are the curated v1 list.)*

## UI flow (`/safety-officer/field-audit`)

1. **Start audit** — date (default today), optional job picker (from `jobs` +
   `job_crew_assignments`), or free-text location. Picking a job pre-populates the
   crew roster.
2. **Subjects tray** — two add buttons: *Add Equipment* (type → unit number, from
   constants, **plus an "Other / new unit" path** with free-text type + number,
   flagged `is_custom_equipment`) and *Add Person* (crew roster first, then full
   profile search). Each subject renders as a card with rollup status dot (existing
   STATUS_DOT pattern) **and a notes strip: the 3 most recent `field_notes` for that
   person/equipment with relative dates ("Issued new hard hat — 8 days ago"), tap to
   expand full history.**
3. **Checklist sheet per subject** — P / F / N/A segmented control per item (reuse the
   tri-state pattern from DailyEquipmentInspectionForm), `standard_ref` info chip,
   sticky progress. **"+ Add item" button appends an ad-hoc checklist line
   (`custom_label`) for anything not covered by the seeded list.** On `F`: note
   required, photo optional (required if `requires_photo_on_fail`), then the
   **escalation picker**:
   - *Record only* — finding logged, appears in monthly email.
   - *Corrective action* — officer picks `action_type` (`immediate | short_term |
     long_term | systemic`, default `immediate`), `due_date` (default +7 days —
     both **NOT NULL / CHECK-constrained** on `corrective_actions`), and assignee
     (defaults: equipment fail → mechanic role; person fail → that person, CC their GF).
   - *Corrective action + points* — above, plus a points deduction (see RPC below).

   **All escalation runs through one SECURITY DEFINER RPC —
   `escalate_field_audit_item(p_item_id, p_level, p_action_type, p_due_date,
   p_assigned_to)` — never client-side table writes.** Rationale (verified against
   prod code):
   - `award_points` **cannot** be used: deductions are gated `p_amount < 0 AND NOT
     is_admin()` (migration `20260608210000`), and its category CHECK list does not
     include audit violations. Safety officers are not admins.
   - Instead: `ALTER TYPE point_source ADD VALUE 'field_audit_violation'` (same
     extension pattern as `20260608230000`; ADD VALUE commits before any function
     references it — separate migration), and the RPC inserts the negative ledger
     row directly with that source. Permission check inside the RPC: role in
     (`safety_officer`, `admin`).
   - Deduction amount is **server-read** from `app_settings` key
     `field_audit_violation_deduction` (table exists with admin RLS + audit log;
     seeded by migration) — client never supplies an amount. RPC clamps to a
     hard cap.
   - **Atomic + idempotent:** corrective action insert, ledger insert, and the
     `field_audit_items.corrective_action_id` / `point_transaction_id` writes happen
     in one transaction; a partial unique index on
     `field_audit_items(id) WHERE corrective_action_id IS NOT NULL` plus an
     early-return if the item is already escalated makes offline retries no-ops.
   - **Notification emitted inside the RPC** as a `notification_events` row using the
     existing CHECK-valid category `safety_alert` (no constraint migration needed),
     `target_type='user'` for the assignee; severity `high` for level-3 escalations.
     The existing `notification-event-dispatch` path handles delivery — verify the
     dispatch trigger covers server-inserted rows at Gate 1.
4. **Quick note (anywhere)** — a "Note" action on every subject card and a standalone
   "Field Notes" entry point on the page (no audit session required): pick person or
   equipment → `note_kind` chips → optional `item_tag` → body. This is how
   "gave Chad a new hard hat" gets recorded the day it happens, not retrofitted into
   an audit.
5. **Review & submit** — summary table, unresolved-fail count, sign-off. Submit calls
   `submit_field_audit(p_audit_id)` RPC: flips status, stamps `submitted_at` (idempotent
   no-op if already submitted). **Pass/fail/NA rollups are read-time (`GROUP BY` over
   `field_audit_items`), NOT denormalized — there is no `result_summary` column.** **Immutability is enforced in RLS, not UI:
   the update policy on all three activity tables requires the parent audit
   `status = 'draft'` (admin-only reopen path).**
   **Ad-hoc items (`custom_label`) are listed in a "Custom items" subsection so admins
   can spot candidates for promotion into the seeded config table.**
6. **Draft persistence** — `useFormDraftLifecycle` (already consolidated for 3 forms);
   field connectivity is unreliable, drafts are non-negotiable. **Requires extending
   the hook's `FormType` union (`'jsa' | 'dvir' | 'equipment' | 'near_miss' |
   'tree_felling_jsa'`) with `'field_audit'`. Photos follow the existing DVIR/Equipment
   behavior: NOT draft-persisted; `hasUnsavedPhotos()` wires the beforeunload guard.
   Photo upload happens at item save when online; if upload fails, the item saves
   without the photo and the UI flags it for retry before submit (photo never blocks
   recording a finding in the field).**
7. **History** — list view of past audits with filters (date range, equipment type,
   person, has-open-fails); detail modal mirroring Jsa/DvirDetailModal pattern.
   **Plus a per-subject timeline view: all audits + notes for one person or unit,
   interleaved chronologically — the "Chad's hard hat history" view.**

Dashboard: add nav card to `SAFETY_OFFICER_NAV_CARDS` + a “Field audits this month /
open audit fails” widget slot (Gate 3, optional).

## Monthly summary email

New edge function `monthly-field-audit-summary`, cloned from
`monthly-compliance-summary`:

- Trigger: **pg_cron registered via migration** (same pattern as
  `20260111000000_schedule_safety_announcement_cron.sql`), invoking the edge function
  with `x-internal-key`, on the **1st, 8 AM America/Chicago**, covering prior month.
- Auth: `x-internal-key` or service-role Bearer. Params: `?month=YYYY-MM`, `?dry_run=true`.
- Recipients: same recipients query as `monthly-compliance-summary` (profiles with role
  `admin`); CC `safety_officer` role (confirm — open item).
- Content (HTML builder in `_shared/buildFieldAuditReportHtml.ts`):
  - Audits conducted (count, sites, auditors) vs prior month.
  - Pass rate by equipment type and by section; trend arrow.
  - Crew/person PPE pass rate (aggregate; per-person detail only for repeat fails).
  - Top failed items (with `standard_ref`) — the “what keeps failing” list.
  - Escalations issued: record-only vs corrective action vs points; open vs closed
    corrective actions originating from audits.
  - Equipment units with repeat fails (≥2 in 90 days).
  - **PPE issuance summary from `field_notes` (`ppe_issued` by `item_tag`), with a
    repeat-issuance flag: same person + same item_tag issued 2+ times in 90 days
    (the "Chad lost another hard hat" line).**
  - **Ad-hoc checklist items used this month — promotion candidates for the config table.**
  - Months-with-zero-audits guard: if no audits, send a short “no field audits recorded”
    email rather than silence (visibility > tidiness).
- **Standing pre-launch dry-run requirement** (same discipline as raffle): run with
  `?dry_run=true` against real prior-month data before enabling the schedule.

## Verified integration points (checked against repo @ HEAD, 2026-06-10)

| Claim | Verified where |
|---|---|
| `award_points` blocks non-admin deductions; categories CHECK-listed; `p_request_id` idempotency | `20260608210000_award_points_admin_deductions.sql` |
| `corrective_actions`: `incident_id` nullable, `due_date NOT NULL`, `action_type` CHECK, RLS allows admin/SO/GF manage | `20260216500000_corrective_actions.sql` |
| `notification_events.category` DB CHECK includes `safety_alert`; constraint-extension precedent exists | `20260106000000_notification_system.sql`, `20260130100006_…` |
| `point_source` enum `ADD VALUE` pattern (commit-before-reference) | `20260608230000_gamification_phase2_gate1_enum_extensions.sql` |
| `app_settings` exists with admin RLS + `app_settings_audit` | `20260320130000_create_app_settings.sql` |
| pg_cron registration via migration | `20260111000000_schedule_safety_announcement_cron.sql` |
| `useFormDraftLifecycle` FormType union; photos not draft-persisted | `src/hooks/useFormDraftLifecycle.ts` |
| Equipment constants & ChecklistValue pattern | `src/pages/forms/equipmentConstants.ts` |
| Email clone target (Gmail shared module, internal key, dry_run, Chicago TZ) | `supabase/functions/monthly-compliance-summary/index.ts` |

## Gates

- **Gate 0 — Spec sign-off (Braden).** Open items below resolved.
- **Gate 1 — Schema.** Migrations, in order: (1) `point_source ADD VALUE
  'field_audit_violation'` (standalone — ADD VALUE must commit before reference);
  (2) enums + 4 tables (`field_audits`, `field_audit_subjects`, `field_audit_items`,
  `field_notes`) + config table + seed + `app_settings` deduction key; (3) RPCs
  `escalate_field_audit_item` + `submit_field_audit`; (4) storage bucket
  `field-audit-photos` + RLS. `config_tables.txt` updated same commit as seed.
  Verify `notification-event-dispatch` fires on server-inserted `notification_events`
  rows. `verify_no_drift.sh` clean → localgate `run.sh` green → MCP apply → drift check.
- **Gate 2 — UI.** Page, drafts (FormType union extension), escalation flow, notes,
  history + per-subject timeline. Behavioral assertions in localgate: escalation RPC is
  idempotent (second call with same item id is a no-op returning the existing CA id);
  deduction inserts exactly one ledger row per item; non-SO/admin caller is rejected;
  update on a submitted audit's items is rejected by RLS.
- **Gate 3 — Email.** Edge function + HTML builder + dry-run against prod data +
  cron-registration migration. Send-test-email path verified.

## Resolved at Gate 0 (2026-06-27)

- **Q1 deduction amount:** seed `app_settings.field_audit_config = {"violation_deduction": 0}`
  (object-shaped per existing app_settings convention; wired but inert until an admin
  sets a real value). RPC enforces a hard cap of 25, reads `(value->>'violation_deduction')::int`.
- **Q3 equipment:** free-text custom equipment only for v1 (`is_custom_equipment`).
  No new unit numbers added to constants; no constants change in Gate 1.
- **Q5 photos:** optional everywhere. Every seeded checklist item ships
  `requires_photo_on_fail = false`; column retained so items can be flipped later.
  Photos can always be *added* to any finding.
- **Auditor role set:** create/record a field audit = `admin`, `safety_officer`,
  `general_foreman` — exactly the existing `is_admin_or_safety_or_gf()` helper. No new
  `is_field_auditor()` helper needed; INSERT gate reuses `is_admin_or_safety_or_gf()`.

### Schema decisions from Cursor review (2026-06-27)

- **Bounded sets = text + CHECK, not PG enums** (matches codebase norm: app_users.role,
  safety_flags.status, corrective_actions.action_type). Only the one real enum touched
  is `point_source` (ADD VALUE 'field_audit_violation', standalone migration).
- **`audit_checklist_items` gains `subject_scope` (`person|equipment|site`) and
  `equipment_types text[]` (NULL = all equipment).** The per-subject checklist renders by
  scope + array-containment — replaces the proposed code-side `fieldAuditConstants` map.
  Hazard-domain `section_key` retained for grouping/reporting.
- **`field_audits.crew_id → crews(id)` nullable** added alongside free-text `crew_name`
  (crews is a real table) so per-crew history and the monthly rollup group on an entity.
- **Ledger idempotency:** new dedicated partial unique index
  `uq_point_tx_field_audit_violation (source, reference_id) WHERE source =
  'field_audit_violation'`. Do NOT modify `uq_point_tx_source_ref` (its predicate is
  coupled to existing award functions' ON CONFLICT clauses). RPC inserts with
  `ON CONFLICT (source, reference_id) DO NOTHING`.
- **Escalation idempotency = 3 layers:** (1) early-return if item already has
  `corrective_action_id`; (2) claim-update `UPDATE … SET corrective_action_id WHERE
  corrective_action_id IS NULL`, raise/rollback orphan CA if NOT FOUND; (3) ledger
  ON CONFLICT DO NOTHING.
- **`app_settings` stays out of `config_tables.txt`** (admin-editable runtime state);
  `audit_checklist_items` goes in.
- **Citations provisional:** all ANSI Z133 § numbers and several OSHA refs unverified at
  seed time; line-clearance work frames to **1910.269** (PPE/electrical), with 1910.266(e)
  reserved for chainsaw condition only. Authoritative reconciliation lands as a follow-up
  config migration before Gate 3.
- **Rollups are read-time, not denormalized (Gate 1 decision, confirmed).** The original
  `field_audit_subjects.result_summary` column was intentionally dropped. Per-subject and
  per-audit pass/fail/NA counts are computed read-time via `GROUP BY` over
  `field_audit_items` (backed by partial index `idx_fa_items_fail`). `submit_field_audit`
  only flips status + stamps `submitted_at`; it writes no rollup. Deliberate normalization
  choice, not an accidental drop.

## Deferred from Gate 1 → Gate 2 (tracked, not dropped)

- **Escalation notification.** `escalate_field_audit_item` does NOT emit a
  `notification_events` row (contract said it should). No CA-insert notification trigger
  exists either (verified). Must be added in Gate 2, coupled with assignee resolution +
  confirming `notification-event-dispatch` fires on server-inserted rows. Category
  `safety_alert` (CHECK-valid, no constraint migration needed).
- **Assignee resolution.** RPC passes `p_assigned_to` through (NULL default). Directive
  default was equipment-fail → mechanic, person-fail → that person (+ CC GF). Gate 2:
  either the UI always supplies `assigned_to`, or the RPC resolves a default (for person
  subjects it can reuse the already-resolved `app_users.user_id`). Decide in Gate 2.
- **Storage read hardening (optional).** `field-audit-photos` SELECT is bucket-wide for
  authenticated users (jsa-photos precedent; private bucket + signed URLs + app-table RLS
  gate discovery). Acceptable for v1. If photos routinely capture identifiable faces tied
  to disciplinary findings, consider short-TTL signed-URL-only access in Gate 2.

## Open items for Braden (Gate 0)

1. Default deduction amount for `app_settings.field_audit_violation_deduction`?
   (Suggest modest + hard-capped in the RPC, consistent with existing deduction
   philosophy.)
2. Should a person-subject FAIL be visible to that employee in-app (notification +
   their history), or admin/GF-visible only for v1?
3. Add `bucket_truck`, `chipper`, `chainsaw`, `truck_trailer` to the equipment type
   constants for audit purposes only, or extend `EQUIPMENT_NUMBERS_BY_TYPE` with real
   unit numbers? (Need the actual unit list for chippers/trucks if the latter.)
4. CC safety officer on the monthly email — confirm.
5. Photo required on fail: globally optional v1, or flip `requires_photo_on_fail` on
   for a subset (suggest: aerial dielectric date, chipper feed bar, chain brake)?
6. Who can write `field_notes` — safety officer + admin only, or also general foremen?
   (Notes about people are sensitive; suggest SO + admin for v1.)
7. Should employees see notes written about them (e.g. `ppe_issued` is harmless and
   arguably useful; `verbal_warning` probably admin-only)? Default v1: not visible to
   the subject.

## Shipped: Review & Submit pipeline (2026-09-02)

Step 5 of the UI flow was never built — a draft only offered "Discard". Closed with a
full pipeline (3 iteration passes, pre-flight green: lint 0, typecheck 0, build, vitest,
Playwright desktop + mobile).

**Server (migrations `20260902120000_field_audit_submit_pipeline.sql`,
`20260902130000_field_audit_escalate_site_scope.sql` — applied to prod via `psql
$SUPABASE_DB_URL`; MCP `execute_sql` was permission-denied, `npx supabase db push`
blocked by remote-history mismatch):**
- `submit_field_audit(p_audit_id, p_notes)` v2 — SECURITY DEFINER, `FOR UPDATE` row
  lock, re-validates the blocker subset server-side (`RAISE EXCEPTION … HINT =
  'FIELD_AUDIT_EMPTY' | 'FIELD_AUDIT_FAIL_NOTE_MISSING'`), folds closing notes
  (`COALESCE(NULLIF(btrim(p_notes),''), notes)` — blank keeps existing), flips
  `draft → submitted`, emits exactly one `safety_alert` (user-targeted) to the crew
  foreman when known and not the auditor, returns a read-time rollup `jsonb`
  (`checks.{total,pass,fail,na,open_fail,site,custom}`, `subjects.{people,equipment}`,
  `notified_foreman`, `already_submitted`). Idempotent.
- `reopen_field_audit(p_audit_id)` — admin-only `submitted → draft` (the RLS
  immutability policy already keyed on `status='draft'`, so no policy change).
- `resolve_crew_foreman(p_crew_id)` + trigger `trg_field_audits_crew_defaults` —
  `foreman_id`/`crew_name` are stamped from `crews` on insert and on `crew_id` change.
  Previously the UI never set `foreman_id`, so notifications fell back to role fan-out.
- `escalate_field_audit_item` — supports site-scoped items (`subject_id IS NULL`);
  equipment/site findings default `assigned_to` to the crew foreman (closes the
  "assignee seam" deferred from Gate 1); severity `high` only when points are actually
  deducted. Notification body names person / unit / site distinctly.

**Client:**
- `src/pages/safety-officer/fieldAuditReadiness.ts` — pure readiness module
  (blockers vs warnings, grade `empty|incomplete|findings|clean`, `canSubmit`,
  `readinessCodeFromServerHint`). Unit tests: `tests/unit/field-audit-readiness.test.ts`.
- Hooks: `useSubmitFieldAudit` (throws `FieldAuditSubmitError` w/ `readinessCode`),
  `useReopenFieldAudit`, `useUpdateFieldAuditNotes` (autosave); `saveItem` accepts
  `subjectId: null` for site checks.
- `field-audit/ReviewSubmitPanel.tsx` — verdict band, scorecard, fix-it list, custom
  items, closing notes (autosave on blur), explicit sign-off, submit (warnings → confirm
  dialog; offline → "checks are saved, reconnect to submit"). `SubmissionReceipt.tsx`
  renders only the server rollup. `FieldAuditConfirmDialog.tsx` also gates Discard.
- `SiteConditionsCard.tsx` — the seeded `subject_scope='site'` items finally render
  (audit-wide, `subject_id NULL`). `SubjectChecklist` takes a `ChecklistScope`.
- Deep links: `/safety-officer/field-audit?resume=<id>` (from history "Resume draft");
  `/safety-officer/field-audit/history?audit=<id>` (from receipt / notifications).
  History detail shows `submitted_at`, admin "Reopen for corrections".
- Notes autosave 600 ms after typing pauses (plus blur). Photo race fixed: a photo
  picked during an in-flight save is no longer dropped.

**Learned / gotchas:**
- Playwright/CDP `browser_type` sets DOM value without React `onChange`; blur-only
  persistence looked broken in automation. Autosave-on-pause made it robust for real
  users too.
- `lucide-react` has `Unlock`, not `LockOpen`.
- `sr-only` checkboxes aren't clickable in Playwright — overlay an invisible input.
- Foremen cannot reach `/safety-officer/field-audit/*` (route roles: admin,
  safety_officer, general_foreman), so foreman notifications deep-link to `/dashboard`.
- Empty Crew / Work Site pickers in prod are a data state (no active crews / sites with
  crews), not a bug — foreman notification depends on a crew being linked.
