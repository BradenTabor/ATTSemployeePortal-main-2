# Frontend-Design Backlog

Work queue for the continuous frontend-design loop (directives/frontend_design_loop.md).
Processed one item per /loop tick. Sev: HIGH = user-facing/perf, MED = consistency, LOW = polish.
Effort: file count. Status: PENDING | COMPLETE | NEEDS-REVIEW | DISMISSED.

> **Source of truth for counts:** `npm run fd:audit` (scripts/fd-audit.mjs). The auditor
> excludes design-system-sanctioned patterns (modal `bg-black/* backdrop-blur-sm`,
> skeleton `animate-pulse`, the `glass.ts`/`animations.ts` source files) that a raw
> `rg` over-counts. Counts below are auditor counts, refreshed 2026-06-06.

## Triage snapshot (2026-06-06)

**Auditor on `main` today:** surface 362/99 · gradientSurface 149/61 · focusRing 280/78 · hoverScale 77/33 · hardZ 84/66 · layoutRhythm 26/17 · longMotion 420/136 · **TOTAL 1398**.

Most rows FD-001–FD-421 were imported as COMPLETE via `ff2755c` (backlog + tooling from stash) but the **code for that pass is not on `main`** — it lives in `stash@{0}` (`frontend-design-wip`). Treat those rows as **STALE** until the stash merges or work is re-applied. Exceptions verified on `main` are listed below.

### Verified COMPLETE on main (post-import)

| ID | Sev | Summary | Commit / evidence | Status |
|----|-----|---------|-------------------|--------|
| FD-423 | MED | Rewards Store page-bundle (redemption `glass.*`, `Z.modal`, WalletHero parity) | `e4202cf`, `ad60af9` | COMPLETE |
| FD-424 | MED | My Points page-bundle (section hierarchy, branded empty/loading, 0 fd violations) | `63b34ab`, `ad60af9` | COMPLETE |
| FD-425 | MED | Shared `WalletHero` + restore `glass.cardGold`/`glass.subtleGold` | `ad60af9` | COMPLETE |
| FD-426 | MED | Duplicate H1 fix — `DashboardLayout.pageHeading` + sr-only H1 default | `0dc91bc` | COMPLETE |
| FD-427 | MED | fd-* audit tooling version-controlled on main (`fd:audit`, `fd:page`, codemods) | `ff2755c` | COMPLETE |

### OPEN (real next work on main)

| ID | Sev | Summary | Current status |
|----|-----|---------|----------------|
| FD-500 | HIGH | focusRing repo-wide re-drain (280 hits/78 files) — FD-130 STALE on main | Unstarted; run `npm run fd:audit -- --fix --category focusRing` |
| FD-501 | MED | longMotion top files: TextEffect, AdminJSA, AdminRewards, MechanicEquipmentLogs (10 hits each) | Unstarted; session 20 "Next" still valid |
| FD-502 | MED | surface top file: IncidentLoggingModal (27 hits) | Unstarted; FD-110 STALE on main |
| FD-503 | MED | gradientSurface top file: ForemanDailyReports (10 hits) | Unstarted; FD-320 STALE on main |
| FD-504 | MED | FD-422 WhatsNewOnboarding glass/`Z.modal`/200ms pass — marked COMPLETE in notes but **not on main** | Open; code in stash only |
| FD-505 | LOW | Merge or selectively apply `stash@{0}` (`frontend-design-wip`) to reconcile FD-001–421 STALE rows | Blocked on stash review |

### STALE (documented COMPLETE, not on main)

- **FD-001–FD-421** (except FD-423/424 above): backlog imported `ff2755c`; implementation in `stash@{0}` only. NotFound still bare (FD-001), AdminUsers still freestyle gold (FD-303/317), focusRing/surface/hardZ "drained to 0" claims do not match main.
- **Duplicate IDs in table below** (FD-413×2, FD-324×2, FD-325×2): historical collision; ignore lower duplicate rows.
- **Session 22 loop note** ("fd scripts absent"): **resolved** by `ff2755c`.
- **Session 23 loop notes 1–2** (cardGold absent, Rewards hex wallet): **resolved** by `ad60af9`.

### Points-system future work (not in this backlog)

Cross-checked `docs/points-system/architecture.md` §Future work — **none of these are tracked in `docs/cursor-agents/backlog.md` or here:**

1. Manual awards `counts_toward_raffle` not entering briefing-based drawing pool (ledger consolidation deferred)
2. Crew streak wave 2 (product decisions + ADR first)
3. Consolidate earning config (`app_settings.reward_points_config` → `point_rules`, raffle path unification)

These belong in a **points/product backlog**, not the frontend-design queue.

---

| ID | Sev | Summary | Target(s) | Effort | Status |
|----|-----|---------|-----------|--------|--------|
| FD-001 | MED | 404 page was 3 bare lines - glass.card, role-aware accent + glow, ghost numeral, staggered motion | src/pages/NotFound.tsx | 1 | COMPLETE |
| FD-002 | HIGH | ErrorBoundary fallbacks plain and inconsistent - match 404 treatment | src/components/layout/ErrorBoundary.tsx | 1 | COMPLETE |
| FD-003 | HIGH | LoadingScreen violated Android perf budget (12 particles, conic-spin, backdrop-blur) - restrained rework | src/components/LoadingScreen.tsx | 1 | COMPLETE |
| FD-004 | HIGH | SessionOverlay animated ~30 nodes - restrained rework | src/components/SessionOverlay.tsx | 1 | COMPLETE |
| FD-005 | MED | PaginationControls off-system green blob, ring-offset-black, Framer hover-scale -> glass.subtle + CSS active:scale | src/components/PaginationControls.tsx | 1 | COMPLETE |
| FD-006 | MED | MechanicDVIRCenter ember surfaces consolidated to glass.cardEmber/subtleEmber (auditor surface=0) | src/pages/mechanic/MechanicDVIRCenter.tsx | 1 | COMPLETE |
| FD-007 | MED | AdminJobProgress: 3 cardGold panels + 2 table headers/row hovers off bg-white/[0.0N] -> glass.cardGold + gray-900/gray-800 | src/pages/admin/AdminJobProgress.tsx | 1 | COMPLETE |
| FD-008 | MED | AdminOperationsHub — auditor surface=0 (raw rg counted allowed modal backdrops); only 1 hover-scale | src/pages/admin/AdminOperationsHub.tsx | 1 | DISMISSED |
| FD-009 | MED | CrewStatusAnalytics: THEME panels -> glass.subtlePurple/cardPurple; table headers -> bg-gray-900/50 | src/pages/general-foreman/CrewStatusAnalytics.tsx | 1 | COMPLETE |
| FD-010 | MED | TeamContacts: bg-white/[0.0N] skeleton + empty states -> bg-gray-800/900 | src/pages/TeamContacts.tsx | 1 | COMPLETE |
| FD-011 | MED | CorrectiveActionForm — auditor surface=0 (already compliant) | src/components/safety/CorrectiveActionForm.tsx | 1 | DISMISSED |
| FD-012 | LOW | OfflineModeBanner — auditor surface=0; amber/blue is intentional semantics per guide §16 | src/components/OfflineModeBanner.tsx | 1 | DISMISSED |
| FD-015 | HIGH | VoiceInputButton focus:ring + ring-offset-1 -> focus-visible:ring + ring-offset-gray-900 | src/components/forms/VoiceInputButton.tsx | 1 | COMPLETE |
| FD-016 | LOW | QuickFilterChips 3 Framer whileHover/whileTap scale -> CSS hover:scale/active:scale | src/components/ui/QuickFilterChips.tsx | 1 | COMPLETE |
| FD-101 | HIGH | DailyEquipmentInspectionForm 26 focus:ring -> focus-visible: (a11y, LOCKED) | src/pages/forms/DailyEquipmentInspectionForm.tsx | 1 | COMPLETE |
| FD-102 | HIGH | DVIRForm 12 focus:ring -> focus-visible: | src/pages/forms/DVIRForm.tsx | 1 | COMPLETE |
| FD-103 | HIGH | DVIR SectionA 12 focus:ring -> focus-visible: | src/pages/forms/dvir/sections/SectionA.tsx | 1 | COMPLETE |
| FD-104 | HIGH | Settings 10 focus:ring -> focus-visible: | src/pages/Settings.tsx | 1 | COMPLETE |
| FD-105 | HIGH | AdminUsers focus:ring drained by autofix; 4 hardcoded z-index converted by fd:fix:zindex | src/pages/admin/AdminUsers.tsx | 1 | COMPLETE |
| FD-130 | HIGH | ENTIRE focusRing category (276 hits/76 files) drained in one pass via `npm run fd:audit -- --fix` | (repo-wide) | 84 | COMPLETE |
| FD-131 | LOW | hardZ safe subset (44 modal/dropdown/drawer sites/37 files) converted to Z.* via `npm run fd:fix:zindex` | (repo-wide) | 37 | COMPLETE |
| FD-132 | LOW | hardZ semantic tail: 40→23 hits/12 files; 17 safe 1-hit files converted to Z.*; remainder = intentional stacks + template literals | (repo-wide) | 12 | COMPLETE |
| FD-110 | MED | IncidentLoggingModal: bg-white/[0.0N] inputs/panels -> bg-gray-800/900 (49 sites) | src/components/admin/IncidentLoggingModal.tsx | 1 | COMPLETE |
| FD-111 | MED | EmployeeAttendance: bg-white/[0.0N] filters/table chrome -> bg-gray-800/900 | src/pages/general-foreman/EmployeeAttendance.tsx | 1 | COMPLETE |
| FD-112 | MED | SafetyBriefingPage: bg-white/[0.0N] -> gray tokens; loading -> glass.elevated; success -> glass.cardEmerald | src/pages/SafetyBriefingPage.tsx | 1 | COMPLETE |
| FD-120 | LOW | DVIRTab: 9 whileHover scale sites -> CSS hover:/active:scale (rotate refresh kept as CSS) | src/pages/mechanic/equipment-logs/DVIRTab.tsx | 1 | COMPLETE |
| FD-121 | LOW | EquipmentTab: 7 whileHover scale sites -> CSS hover:/active:scale | src/pages/mechanic/equipment-logs/EquipmentTab.tsx | 1 | COMPLETE |
| FD-200 | HIGH | COMPLIANCE-FORMS LENS: iOS input-zoom (`inputZoom`) drained across all safety forms — 39 sub-16px field tokens -> `text-base` via new `npm run fd:fix:input-zoom` AST codemod | (compliance forms, 14 files) | 14 | COMPLETE |
| FD-201 | MED | New auditor category `gradientSurface` (inline arbitrary-hex gradient surfaces) added to fd-audit.mjs — 304 hits/78 files surfaced (was invisible to the `surface` rule) | (repo-wide, tooling) | — | COMPLETE |
| FD-202 | MED | DailyEquipmentInspectionForm 6 inline hex-gradient card surfaces -> glass.cardEmerald (preserves emerald identity via sanctioned token) | src/pages/forms/DailyEquipmentInspectionForm.tsx | 1 | COMPLETE |
| FD-203 | MED | DVIRForm gradientSurface pass — auditor reports 0 (focusRing already drained; no inline gradients) | src/pages/forms/DVIRForm.tsx | 1 | DISMISSED |
| FD-204 | MED | ContactTemplatePicker dialog panel inline hex-gradient -> glass.elevated (canonical modal surface) | src/components/forms/ContactTemplatePicker.tsx | 1 | COMPLETE |
| FD-205 | MED | DuplicateWarningModal dialog fill -> glass.elevated (amber warning border/glow preserved) | src/components/forms/DuplicateWarningModal.tsx | 1 | COMPLETE |
| FD-206 | MED | SavedLocationPicker dialog fill -> glass.elevated | src/components/forms/SavedLocationPicker.tsx | 1 | COMPLETE |
| FD-207 | LOW | ExampleJobForm gradient hit is a gold CTA button (not a surface) in a non-production sample file | src/components/forms/ExampleJobForm.tsx | 1 | DISMISSED |
| FD-208 | MED | DailyEquipmentInspectionForm surface debt 15->2: input/tile bg-white/[0.0N] -> bg-gray-800 (guide §3/§11); 2 decorative photo-chip backdrop-blur left (legibility over photos) | src/pages/forms/DailyEquipmentInspectionForm.tsx | 1 | COMPLETE |
| FD-300 | MED | COLOR LENS: new `fd:gradients` analyzer (classifies gradients by role; maps surfaces to glass.* tokens). Found admin-gold & foreman-blue surfaces had NO token | scripts/fd-gradients.mjs | — | COMPLETE |
| FD-301 | MED | Added 4 missing role-surface tokens to glass.ts: cardGold/subtleGold/cardBlue/subtleBlue (gives ~75 freestyle admin/foreman panels a home; identity preserved via dominant hex) | src/lib/glass.ts | 1 | COMPLETE |
| FD-302 | MED | LAYOUT LENS: new `layoutRhythm` auditor category (arbitrary gap/p/m/space-[Npx] + rounded-[Npx] off the scale) — 32 hits/19 files surfaced | scripts/fd-audit.mjs | — | COMPLETE |
| FD-303 | MED | AdminUsers: 3 identical freestyle gold modal surfaces -> glass.cardGold (first consolidation via the new analyzer) | src/pages/admin/AdminUsers.tsx | 1 | COMPLETE |
| FD-310 | MED | AdminJSA: filter panel + detail modal -> glass.subtleGold; table shell -> glass.cardGold; removed backdrop-blur-xl on both modal + table | src/pages/admin/AdminJSA.tsx | 1 | COMPLETE |
| FD-311 | MED | JobList 4 main gold panels -> glass.subtleGold/cardGold (2 stacked-shadow decorative layers remain) | src/components/jobs/JobList.tsx | 1 | COMPLETE |
| FD-312 | MED | SafetyAnalyticsDashboard: user detail modal -> glass.subtleGold; leaderboard + 3 side stat panels -> glass.cardGold | src/pages/admin/SafetyAnalyticsDashboard.tsx | 1 | COMPLETE |
| FD-313 | MED | ManualAwardsHub hero panel -> glass.subtleGold | src/pages/admin/ManualAwardsHub.tsx | 1 | COMPLETE |
| FD-314 | MED | AdminUserActivity: session cards, filters, live feed -> glass.subtleGold/cardGold; feed header -> solid bg | src/pages/admin/AdminUserActivity.tsx | 1 | COMPLETE |
| FD-315 | MED | SafetyAnalyticsSection: modal -> glass.subtleGold; leaderboard + stat panels -> glass.cardGold | src/pages/admin/safety-compliance/SafetyAnalyticsSection.tsx | 1 | COMPLETE |
| FD-316 | MED | UserRewardsDetailModal -> glass.subtleGold | src/components/admin/UserRewardsDetailModal.tsx | 1 | COMPLETE |
| FD-317 | MED | AdminUsers (2nd pass): mobile card, delete modal, search, table -> glass.subtleGold/cardGold; thead solid | src/pages/admin/AdminUsers.tsx | 1 | COMPLETE |
| FD-318 | MED | AdminRTO: mobile cards + filter -> glass.subtleGold; table shell -> glass.cardGold; thead solid | src/pages/admin/AdminRTO.tsx | 1 | COMPLETE |
| FD-319 | MED | AdminPartsFixesOverview: StatCard, AI summary, FilterBar -> glass.subtleGold | src/pages/admin/AdminPartsFixesOverview.tsx | 1 | COMPLETE |
| FD-304 | MED | Admin gold/neutral drain: AdminTelemetry, AdminPremiumScaffold (5/6 themes), FeaturePreviews, RiskCalibrationSection — ember hero in scaffold left intentional | (admin pages) | 1 | COMPLETE |
| FD-320 | MED | ForemanDailyReports 10 blue surfaces -> glass.subtleBlue/cardBlue | src/pages/foreman/ForemanDailyReports.tsx | 1 | COMPLETE |
| FD-321 | MED | CrewOversightJobList 4 purple surfaces -> glass.subtlePurple/cardPurple | src/components/jobs/CrewOversightJobList.tsx | 1 | COMPLETE |
| FD-322 | MED | GeneralForemanDashboard job-site composition -> glass.subtlePurple | src/pages/general-foreman/GeneralForemanDashboard.tsx | 1 | COMPLETE |
| FD-323 | MED | RiskCalibrationSection 3 metric panels -> glass.subtleBlue/subtlePurple/subtleGold | src/pages/admin/safety-compliance/RiskCalibrationSection.tsx | 1 | COMPLETE |
| FD-324 | MED | Added cardEmber/subtleEmber to glass.ts + ember palette detection in fd-gradients (mechanic role had no token, was mis-mapped to cardRed) | src/lib/glass.ts, scripts/fd-gradients.mjs | 2 | COMPLETE |
| FD-325 | MED | MechanicDashboard: hero, nav cards, quick action, nav sections -> glass.cardEmber/subtleEmber | src/pages/mechanic/MechanicDashboard.tsx | 1 | COMPLETE |
| FD-308 | MED | AdminEmailRecipients 2 subtleGold panels -> glass.subtleGold | src/pages/admin/AdminEmailRecipients.tsx | 1 | COMPLETE |
| FD-309 | MED | AdminRewards 5 gold surfaces -> glass.subtleGold/cardGold | src/pages/admin/AdminRewards.tsx | 1 | COMPLETE |
| FD-307 | MED | AdminMassSms: 2 identical subtleGold hero/form panels -> glass.subtleGold via cn() (preserved rounded-2xl/3xl + hero shadow) | src/pages/admin/AdminMassSms.tsx | 1 | COMPLETE |
| FD-305 | MED | Foreman blue drain: ForemanDailyReports (FD-320); remaining 1-hit files are purple/general-foreman not blue | (foreman blue pages) | 1 | COMPLETE |
| FD-306 | MED | BrandedNavCard: layoutRhythm done; outer role gradients -> glass.* (emerald custom kept); pl-[60px] icon offset intentional | src/components/BrandedNavCard.tsx | 1 | COMPLETE |
| FD-324 | LOW | Home login submit gradient is CTA accent (not a surface) — fd-gradients false positive | src/pages/Home.tsx | 1 | DISMISSED |
| FD-325 | MED | Admin gold tail: CrewManager, GoldCollapsibleSection, JobCard, JobDetailModal, SafetyPointsLeaderboard, AdminOperationsHub, AdminWorkSites, AdminJobTracker -> glass.cardGold/subtleGold | (admin/job modals) | 8 | COMPLETE |
| FD-326 | MED | Mechanic ember drain: DVIRCenter, EquipmentCenter, PartsRepairsLog, PendingDefectsWidget, EquipmentInspectionControlCenter, mechanic sub-panels | (mechanic pages) | 10 | COMPLETE |
| FD-327 | MED | Dashboard/announcements: DashboardGrid, ExpandableSection, Announcements, StackedJobCard, FeaturedAnnouncementSection -> glass.* | (dashboard) | 5 | COMPLETE |
| FD-328 | MED | Remaining 1-hit surface files: modals, collapsibles, error boundaries, AssignedJobs, RequiredUpdatePrompt, etc. | (scattered) | 12 | COMPLETE |
| FD-329 | LOW | hardZ safe 1-hit batch: 17 files -> Z.* (AnnouncementAlert through BulkActionBar) | (repo-wide) | 17 | COMPLETE |
| FD-330 | MED | EnhancedRewardsCard: 5 off-system surfaces (backdrop-blur + bg-white/5) -> solid gray-800/level tints | src/components/dashboard/EnhancedRewardsCard.tsx | 1 | COMPLETE |
| FD-331 | HIGH | Quote corruption recovery: fd-audit surface batch stripped ternary/hover: quotes — `scripts/fd-fix-quote-corruption.mjs` restored 77 files | (repo-wide) | 77 | COMPLETE |
| FD-332 | MED | BrandedNavCard: remove backdrop-blur-sm/xl (Coming Soon badge + inner card); solid slate gradient badge | src/components/BrandedNavCard.tsx | 1 | COMPLETE |
| FD-333 | MED | AdminPartsFixesOverview: AI metrics row + loading/empty shells -> glass.subtleGold (6 freestyle panel gradients removed) | src/pages/admin/AdminPartsFixesOverview.tsx | 1 | COMPLETE |
| FD-334 | MED | AdminPartsFixesOverview: AI hero -> single glass.cardGold shell; remove animated border/shimmer; summary panel border wrapper -> glass.subtleGold | src/pages/admin/AdminPartsFixesOverview.tsx | 1 | COMPLETE |
| FD-400 | MED | Surface autofix: extended `SAFE_FIXERS.surface` in fd-audit.mjs (`bg-white/[0.0N]` + `bg-white/5|10`); repo-wide `--fix --category surface` batch; quote-corruption recovery via repair scripts | scripts/fd-audit.mjs, (repo-wide) | 167 | COMPLETE |
| FD-401 | MED | Top-6 surface tail: Home, ResetPassword, AdminDashboard, AdminPartsFixesOverview, Forms — backdrop-blur removed; gold/emerald panels → glass.* | (5 pages) | 5 | COMPLETE |
| FD-402 | MED | Surface category drained to 0: 39-line blur strip on 33 files (modal `bg-black/*` backdrops preserved); auditor skips comment lines | (repo-wide) | 33 | COMPLETE |
| FD-407 | MED | PAGE LENS: new `fd:page` bundle auditor (`npm run fd:page`) — scoped audit + composition hints for named routes | scripts/fd-page.mjs | — | COMPLETE |
| FD-408 | MED | Announcements page pass: page-level search/sync toolbar (glass.subtleEmerald); featured hero simplified (removed 12s conic + orb loops + inline bg); feed CSS hover; pagination subtleEmerald; input text-base | src/pages/Announcements.tsx | 1 | COMPLETE |
| FD-409 | MED | AnnouncementDetailModal: static sparkle badge, title bg-clip-text, stamp motion capped 0.2s | src/components/AnnouncementDetailModal.tsx | 1 | COMPLETE |
| FD-410 | LOW | Legacy AnnouncementCard: whileHover scale → CSS hover/active scale | src/components/AnnouncementCard.tsx | 1 | COMPLETE |
| FD-411 | MED | gradientSurface auditor aligned with fd-gradients role classifier (`scripts/fd-gradient-classify.mjs`) — 148 noisy hits → 0 | scripts/fd-audit.mjs, scripts/fd-gradient-classify.mjs | 3 | COMPLETE |
| FD-412 | LOW | hoverScale batch: `npm run fd:fix:hover-scale` (54 conversions) + composite multi-axis allow in auditor — 73 → 0 | scripts/fd-fix-hover-scale.mjs, (repo-wide) | 28 | COMPLETE |
| FD-413 | HIGH | Restored missing `src/lib/zIndex.ts`; portal + offline drawer stacks → Z.portalBackdrop/portalMenu + Z.offlineDrawer* (WelcomeHeader, AvatarDropdown, FloatingPanel, ExpandableScreen, OfflineQueuePanel, GF SafetyCompliance) | src/lib/zIndex.ts, (6 files) | 7 | COMPLETE |
| FD-413 | MED | CollectPointsButton: removed infinite gift/sparkle/glow loops; hover transitions 200ms; CSS scale; claim burst 0.2s | src/components/CollectPointsButton.tsx | 1 | COMPLETE |
| FD-414 | MED | ExpandableSection: chevron/icon/card transitions duration-300 → duration-200 (Android budget) | src/components/dashboard/ExpandableSection.tsx | 1 | COMPLETE |
| FD-415 | MED | Restored missing `src/lib/zIndex.ts` (Z.* scale) — unblocks typecheck for ManualAwards modals | src/lib/zIndex.ts | 1 | COMPLETE |
| FD-416 | MED | layoutRhythm drained to 0: arbitrary `rounded-[Npx]` → scale tokens (28/35/25/10/20/16px); CompactJobCard `ml-[18px]`→`ml-5`; auditor allows gradient bezels + incident bezel + BrandedNavCard icon inset | (13 files) + fd-audit.mjs | 13 | COMPLETE |
| FD-417 | LOW | hardZ tail drained: AdminOperationsHub, IncidentLoggingModal (+ Z.modalNested), JsaExportModal, CertificationResultOverlay, PWAUpdatePrompt, EmergencyActionPlan skip-link | (6 files) + zIndex.ts | 7 | COMPLETE |
| FD-418 | MED | FeaturedAnnouncementSection: Announcements-pattern hero — glass.cardEmerald, static orbs, no conic/loop motion, 200ms transitions (longMotion 9→0) | src/components/dashboard/FeaturedAnnouncementSection.tsx | 1 | COMPLETE |
| FD-419 | MED | Dashboard.tsx: job card CSS hover; section entrances 0.2s; toast duration false-positive removed (longMotion 3→0) | src/pages/Dashboard.tsx | 1 | COMPLETE |
| FD-420 | LOW | hardZ fully drained (12→0): Z.* on AdminOperationsHub, IncidentLoggingModal, DailyJSAForm, JsaExportModal, CertificationResultOverlay, PWAUpdatePrompt; auditor allows `focus:z-50` skip-links | (7 files) + fd-audit.mjs | 7 | COMPLETE |
| FD-421 | MED | longMotion batch start: auditor allows `repeat: Infinity` ambient loops + precomputed particle durations; UI transitions capped 0.2s on AdminPartsFixesOverview (24→0) + WhatsNewOnboarding (11→0) | (2 files) + fd-audit.mjs | 3 | COMPLETE |
| FD-422 | HIGH | WhatsNewOnboarding refresh: WHATS_NEW_FEATURES v1.1.0 slides (offline forms, rewards, certs, tree felling); glass.* surfaces, Z.modal, 200ms UI motion, focus-visible rings | WhatsNewOnboarding.tsx, appVersion.ts | 2 | COMPLETE |
| FD-423 | MED | Rewards Store page bundle: layout hierarchy, wallet hero parity with My Points, glass.* surfaces on catalog/history/modals, Z.toast/Z.modal stacks, styled loading/empty/error states | RewardsStorePage.tsx, src/components/redemption/* (5 files) | 6 | COMPLETE |
| FD-424 | MED | My Points page pass: section hierarchy (wallet/holds, monthly grid, ledger group, hub links), tokenized wallet gradient (amber/stone, no hex), branded empty states, glass.subtle skeletons, 200ms motion, focus-visible hub links | src/pages/MyPointsPage.tsx | 1 | COMPLETE |
| FD-425 | MED | Shared WalletHero + restore glass.cardGold/subtleGold for My Points + Rewards Store wallet parity | src/components/points/WalletHero.tsx, src/lib/glass.ts | 3 | COMPLETE |
| FD-426 | MED | Duplicate page headings — DashboardLayout.pageHeading opt-in; decorative title + sr-only H1 default | src/layouts/DashboardLayout.tsx + 52 pages | 53 | COMPLETE |
| FD-427 | MED | Version-control fd-* audit tooling on main (fd-audit, fd-page, codemods, directives) | scripts/fd-*.mjs, scripts/fd-*.ts, directives/ | 11 | COMPLETE |

## Notes

### 2026-06-06 (session 23) — My Points page-bundle design pass
- **FD-424 COMPLETE** — Single-file visual pass on `/my-points` (no hooks/logic; breakdown reconcile preserved).
  - **Iter 1:** Wallet hero hex gradient → `border-amber-400/20 bg-gradient-to-br from-amber-950/80 via-stone-950 to-stone-950`; `#f4c979` accents → `amber-300/400`; `space-y-6` rhythm; grouped sections ("This month" 2-col raffle+streak, "Your ledger" breakdown+activity, "Go further" hub links); branded empty states (PieChart/History icons in `glass.subtle` panels); loading skeletons → `glass.subtle`; motion `pageEnter` 200ms; hub links `focus-visible:outline-emerald-400`.
- **Before:** `fd:page` bundle 2 violations (MyPointsPage 1× gradientSurface + DashboardLayout 1× hardZ); flat card stack, gray text empty states, `bg-white/[0.03]` pulse skeletons.
- **After:** MyPointsPage.tsx `fd:audit --file` = **0** violations; bundle residual 1 (DashboardLayout hardZ, out of scope).
- Verify: typecheck PASS, eslint PASS, build PASS, MyPointsPage unit tests 5/5 PASS.
- **Loop notes — resolved in follow-up commits:**
  1. ~~`glass.cardGold`/`glass.subtleGold` absent~~ → **FD-425 COMPLETE** (`ad60af9`).
  2. ~~Rewards Store wallet hex gradient divergent~~ → **FD-425 COMPLETE** (`WalletHero` shared).
  3. `fd:page` bundle violation count includes layout shell hits (DashboardLayout) — report page-file count separately in agent summaries to avoid false "still failing" reads. *(Still valid process note.)*

### 2026-06-06 (session 22) — Rewards Store page-bundle design pass
- **FD-423 COMPLETE** — Scoped visual pass on `/rewards-store` + redemption components (no hook/logic changes).
  - **Iter 1 (RewardsStorePage):** Grouped nav links in `aria-label` toolbar; balance hero aligned with My Points wallet (icon, typography, gold gradient shell); `space-y-6` section rhythm; catalog/history loading skeletons → `glass.subtle`; catalog error + success toast → styled panels (`glass.success`, `Z.toast`); motion capped 200ms; `text-white/60` body copy for AA contrast.
  - **Iter 2 (RedemptionHowItWorks):** `glass.subtle` + amber border; larger step badges; improved step spacing/line-height.
  - **Iter 3 (RewardCatalogGrid):** Cards → `glass.card` with gold border when redeemable; removed muddy image placeholder gradient → solid `bg-gray-800`; empty state copy hierarchy; disabled CTA → `bg-gray-800`; focus-visible rings on redeem buttons; stagger delay capped.
  - **Iter 4 (RedemptionHistoryList):** Row cards → `glass.card`; empty/error states styled; metadata contrast bumped to white/50–60; cancel button focus-visible.
  - **Iter 5 (RedeemConfirmModal + RedemptionConfirmDialog):** `Z.modal` / `Z.modalNested`; summary panel → `glass.subtle`; secondary buttons → `bg-gray-800`; spring → 200ms tween; error alerts styled.
- **Before:** Flat `bg-white/[0.03]` panels, stacked nav links, minimal balance card, raw error text, hardcoded `z-[9998/9999]`, muddy catalog image gradients.
- **After:** Consistent ATTS solid-surface system, gold wallet identity matching My Points, grouped navigation, accessible focus rings, tokenized z-index, polished empty/loading/error states.
- Verify: typecheck PASS, eslint PASS, redemption unit tests 7/7 PASS.
- **Loop note — resolved:** ~~`scripts/fd-page.mjs` / `npm run fd:audit` absent~~ → **FD-427 COMPLETE** (`ff2755c`).

### 2026-06-06 (session 21) — What's New onboarding content + design pass
- **FD-422 COMPLETE** — Carousel content updated for v1.1.0 (offline safety forms, safety rewards,
  certifications, tree felling JSA). Component aligned to solid surface system (`glass.subtle`/`elevated`/`subtleEmerald`),
  `Z.modal` stacking, 200ms interaction transitions, CSS hover scale on nav controls. Verify: typecheck PASS, eslint PASS.

### 2026-06-06 (session 20) — hardZ zero + longMotion auditor tuning
- **FD-420 COMPLETE** — Final hardZ tail → `style={{ zIndex: Z.* }}` (modal/dropdown/sticky/toast/portal as appropriate).
  Auditor `allow()` for variant-prefixed z (`focus:z-50` on EmergencyActionPlan skip-link). **hardZ 12 → 0**.
- **FD-421 COMPLETE** — Extended `longMotion` `allow()` for decorative `repeat: Infinity` loops and particle
  config durations; capped entrance/hover transitions on AdminPartsFixesOverview + WhatsNewOnboarding.
  **longMotion 501 → 366**. Verify: typecheck PASS, eslint PASS.
- **Next:** longMotion top files (TextEffect, AdminJSA, AdminRewards, MechanicEquipmentLogs).

### 2026-06-06 (session 19) — Dashboard announcement hero + page motion
- **FD-418 COMPLETE** — FeaturedAnnouncementSection aligned with Announcements featured card.
- **FD-419 COMPLETE** — Dashboard job cards + section motion capped at 200ms.
- Verify: typecheck PASS, eslint PASS, fd:audit 0 for both files.

### 2026-06-06 (session 18) — layoutRhythm category drained
- **FD-416 COMPLETE** — Replaced off-scale arbitrary radii (`rounded-[28px]`→`rounded-3xl`, hub shells
  `rounded-[25px]`→`rounded-3xl`, login cards `rounded-[1.75rem/2rem]`→`rounded-3xl`, etc.).
  CompactJobCard indent `ml-[18px]`→`ml-5`. Extended `layoutRhythm` auditor `allow()` for gradient
  bezels (`p-[1px|1.5px]`), `glass.incidentOuter` radius, and BrandedNavCard `iconAsImage` pl inset.
  **layoutRhythm 29 → 0**. Verify: typecheck PASS, eslint PASS.
- **Next:** hardZ tail (12 / 7 files), longMotion (~525).

### 2026-06-06 (session 17) — Announcements bundle fully clean
- **FD-413 COMPLETE** — CollectPointsButton: stripped 2s/3s infinite Framer loops (claimed pulse, gift wiggle,
  sparkle rotate, pulsing glow); celebration burst 0.6s→0.2s; hover layers duration-200; CSS hover/active scale.
- **FD-414 COMPLETE** — ExpandableSection: duration-300→200 on card shell, icon glow, chevron rotation.
- **FD-415 COMPLETE** — Recreated `src/lib/zIndex.ts` (was missing from tree; typecheck failed on ManualAwards imports).
- Verify: `npm run fd:page -- Announcements` **bundle violation lines: 0**. typecheck PASS, eslint PASS.

### 2026-06-06 (session 17) — zIndex.ts restore + portal/offline hardZ stacks
- **FD-413 COMPLETE** — `src/lib/zIndex.ts` was missing from the tree (50+ imports broken). Restored locked
  scale (base→tooltip) plus `offlineDrawer*` (60–62) and `portalBackdrop`/`portalMenu` (9998/9999) pairs.
  Converted hardcoded stacks in WelcomeHeader, AvatarDropdownPortal, FloatingPanel, ExpandableScreen,
  OfflineQueuePanel, GeneralForemanSafetyCompliance. Verify: typecheck PASS, eslint PASS.
- **Next:** remaining hardZ tail (AdminOperationsHub z-[9999], celebration overlays, IncidentLogging z-[60]),
  layoutRhythm (~29), longMotion (~530).

### 2026-06-06 (session 16) — gradientSurface + hoverScale categories drained
- **FD-411 COMPLETE** — Shared `scripts/fd-gradient-classify.mjs`; `fd-audit` gradientSurface uses
  `isAllowedGradientLine()` (text/border/decoration/accent/CTA excluded; `hover:from-[#` → accent).
  **gradientSurface 148 → 0** — no real panel surfaces remain per `fd:gradients --surfaces`.
- **FD-412 COMPLETE** — `npm run fd:fix:hover-scale` codemod + manual template-literal tail; auditor
  `allow()` for composite whileHover (rotate/y/boxShadow/ternary). **hoverScale 73 → 0**.
- Verify: typecheck PASS, eslint PASS.
- **Next:** hardZ tail (23 / 12 files), layoutRhythm (~29), longMotion (~530).

### 2026-06-06 (session 15) — Page-bundle lens + Announcements route pass
- **FD-407 COMPLETE** — Added `scripts/fd-page.mjs` (`npm run fd:page -- <page>`). Layer-3 page-bundle
  auditor: resolves route file, walks static local imports (depth configurable), runs fd:audit +
  fd:gradients + fd:fix:input-zoom per file, emits composition hints (search-in-collapsible, inline style
  gradients, infinite hero motion, whileHover scale). Documented in directive as "Page-bundle lens".
- **FD-408 COMPLETE** — Announcements: moved SearchBar + Live Sync + Sync Feed to page-level toolbar
  (`glass.subtleEmerald`) so search works even when "Previous Updates" is collapsed or empty; featured card
  uses `glass.cardEmerald` only (removed inner inline gradient, 12s conic ring, 8–10s floating orbs, 2s
  sparkle wiggle); title uses Tailwind `bg-clip-text`; feed cards CSS hover lift; pagination
  `glass.subtleEmerald`; search input `text-base` + `glass.subtleEmerald`. longMotion in page: 5 → 0.
- **FD-409/410 COMPLETE** — Modal sparkle static, stamp 0.2s; legacy AnnouncementCard hoverScale fixed.
- Verify: typecheck PASS, eslint PASS, `npm run fd:page -- Announcements` composition hints clear.

### 2026-06-06 (session 14) — surface category fully drained
- **FD-402 COMPLETE** — Targeted script stripped `backdrop-blur*` from all non-sanctioned lines
  (39 lines / 33 files). Modal backdrops (`bg-black/*` + blur, §18) left intact. Auditor updated to
  skip comment-only lines (LoadingScreen/SessionOverlay doc false positives). **surface 39 → 0**.
- Verify: typecheck PASS, eslint PASS.
- **Next lens:** gradientSurface (~156), hoverScale (~73), hardZ tail (23 NEEDS-REVIEW), layoutRhythm (~29).

### 2026-06-06 (session 13) — surface autofix batch + top-file blur removal
- **FD-400 COMPLETE** — Extended `SAFE_FIXERS.surface` to swap `bg-white/[0.0N]` even on lines that still
  carry `backdrop-blur` (blur removal stays manual). Added `bg-white/5` → `bg-gray-900`, `bg-white/10` →
  `bg-gray-800`. Ran `npm run fd:audit -- --fix --category surface` repo-wide. Fixed a non-capturing-group
  bug (`$1bg-gray` literal corruption) and recovered ~166 files via bulk quote-repair scripts.
- **FD-401 COMPLETE** — Manual pass on highest-count surface files: login cards (Home/ResetPassword) solid
  `bg-gray-800/900` inputs; AdminDashboard sections → `glass.cardGold`, contact modal → `glass.subtleGold`;
  AdminPartsFixesOverview hero → `glass.cardGold`, stat tiles solid; Forms filter/empty → `glass.cardEmerald`/
  `glass.card`. Verify: surface **256 → 39**, typecheck PASS, eslint PASS.
- **Totals now:** surface 39/33 files · gradientSurface ~156 · focusRing 0 · hoverScale ~73 · hardZ 23 ·
  layoutRhythm ~29 · longMotion ~530.
- **Next:** drain remaining 33-file surface tail (mostly 1–2 hit modals/overlays); LoadingScreen (2) is
  intentional atmospheric blur — likely DISMISSED or NEEDS-REVIEW per §13/§18.

### 2026-06-05 (session 6) — COLOR-GRADIENT LENS + LAYOUT LENS (two new loop capabilities)
- **Why:** the loop could detect gradient/surface drift but couldn't ACT on it — the `gradientSurface` line
  count lumped text gradients, button fills, decorative orbs, borders, and real card surfaces together, so
  "flatten the gradient" was unactionable (~60% of hits were intentional non-surfaces). And the loop had NO
  layout/organization lens at all. This session added both, per the user's ask to make gradient + layout work concrete.
- **FD-300 COMPLETE — gradient palette analyzer `scripts/fd-gradients.mjs` (`npm run fd:gradients`).** Layer-3
  tool. Classifies every `bg-gradient-to-* from-[#hex]` by ROLE (text | accent | border | decoration | icon |
  surface) using context + stop-lightness (a true surface has a near-black anchor stop; an all-light gradient
  is a button/badge ACCENT, not a panel). For surfaces it detects the color FAMILY (HSL hue of the most-
  saturated stop) and maps to the nearest `glass.*` token; clusters identical signatures. Modes: `--plan`,
  `--missing`, `--surfaces`, `--file`, `--json`. Refined counts: 330 total hits → only **144 are real surfaces**
  (87 accents, 68 decoration, 28 text correctly excluded).
- **FD-301 COMPLETE — the big finding + fix: admin-gold & foreman-blue had NO surface token.** `--missing`
  revealed ~75 freestyle dark-gold (admin) and dark-blue (foreman) panel surfaces across 28 files with no home
  in `glass.ts` — even though admin (gold) is the app's most common role. Added 4 tokens to `@/lib/glass.ts`:
  `cardGold`, `subtleGold`, `cardBlue`, `subtleBlue`, based on the DOMINANT existing hex signatures
  (`from-[#1b1914] via-[#120f0c] to-[#080705]`, `from-[#0a1628]...to-[#020408]`) so the visual identity is
  preserved exactly. Purely additive — no LOCKED token VALUES changed. Sanctioned by guide §"Surface System".
- **FD-302 COMPLETE — `layoutRhythm` auditor category.** Added to `scripts/fd-audit.mjs`. Flags arbitrary
  spacing/radius UTILITIES (`gap/p/m/space-[Npx]`, `rounded-[Npx]`) that break the §8 spacing scale / §4 radius
  system. Deliberately ignores arbitrary positions/sizes (`top-`/`w-`/`-translate-`), `calc()`/`env()` safe-area
  insets, and negative margins (intentional bleed). Surfaced **32 hits / 19 files**.
- **FD-303 COMPLETE — first consolidation via the analyzer.** AdminUsers had 3 IDENTICAL freestyle gold modal
  surfaces; replaced with `glass.cardGold` (template literal, no dup utilities). Surfaces in file 8→5; subtleGold
  cluster 52→49. Verify: typecheck PASS, eslint PASS.
- **Loop leverage learning:** the highest-value gradient move wasn't grinding one file/tick — it was the
  analyzer revealing a *systemic* gap (two whole role palettes with no token) that one additive `glass.ts` edit
  closes, unlocking dozens of cheap, faithful per-tick consolidations (FD-304/305 queued).
- Current totals: surfaces (real, gradient) 137 · subtleGold drift 46/22 files · subtleBlue 11/5 · layoutRhythm 32/19.

### 2026-06-06 (session 8) — subtleGold consolidation batch + layoutRhythm tick
- **FD-007 COMPLETE** — AdminJobProgress: filter + 2 analytics tables → `glass.cardGold`; removed filter
  `backdrop-blur-sm`; table headers `bg-white/[0.02]` → `bg-gray-900/50`, row hover → `hover:bg-gray-800`.
  gradient surfaces in file: 0. surface hits: 5 → 0.
- **FD-308 COMPLETE** — AdminEmailRecipients: hero + main panel → `glass.subtleGold`. gradient surfaces: 0.
- **FD-309 COMPLETE** — AdminRewards: user cards, stat blocks, search panel → `glass.subtleGold`; users grid
  → `glass.cardGold`. Text/accent/decoration gradients left intact. gradient surfaces: 0.
- **FD-310 COMPLETE** — JobList: filter skeleton, filter bar, empty state, main stacked card → `glass.subtleGold`/
  `glass.cardGold`. 2 decorative stack-shadow layers (opacity variants) remain — intentional depth effect.
- **FD-306 NEEDS-REVIEW** — BrandedNavCard layoutRhythm **4 → 1**: `p-[2px]`→`p-0.5`, arbitrary radii→scale
  tokens. Remaining `pl-[60px] sm:pl-[68px] md:pl-[76px]` is icon-as-image bespoke offset (not safely
  roundable without visual regression). Role `outer` gradient strings in theme config untouched (accent identity).
- Verify: typecheck PASS, eslint PASS, build PASS (bundle PASS).

### 2026-06-06 (session 7) — subtleGold consolidation tick
- **FD-307 COMPLETE** — AdminMassSms: both freestyle `from-[#1b1914] via-[#120f0c] to-[#080705]` panels →
  `glass.subtleGold` via `cn()`, keeping hero `rounded-2xl sm:rounded-3xl`, `/20` border, and dramatic shadow.
  Text gradient heading left intact. Verify: fd-gradients surface=0 for file, typecheck PASS, eslint PASS.
  subtleGold cluster 48→46.

### 2026-06-06 (session 12) — Mechanic ember role tokens
- **FD-324 COMPLETE** — Added `cardEmber`/`subtleEmber` to `glass.ts` (same pattern as gold/blue). Updated
  `fd-gradients` with `isEmberPalette()` so mechanic warm-brown stops map to ember (were misclassified as rose/neutral).
- **FD-325 COMPLETE** — MechanicDashboard: hero → `glass.cardEmber`; nav cards, quick action, sections →
  `glass.subtleEmber`. Primary CTA bright orange gradient left as accent. Verify: surface=0, typecheck PASS, eslint PASS.

### 2026-06-06 (session 12) — gradient surface zero + hardZ batch
- **FD-325–328 COMPLETE** — Drained all ranked `fd:gradients --surfaces` files to **0** except Home login CTA (FD-324 DISMISSED).
  Admin modals (CrewManager, OperationsHub, WorkSites, JobTracker, etc.), mechanic ember pages + 6 sub-panels,
  BrandedNavCard outer variants, dashboard grids, and scattered 1-hit components all on `glass.*`.
- **FD-329 COMPLETE** — hardZ 40→23: 17 safe single-hit files converted to `style={{ zIndex: Z.* }}`.
- **FD-132 NEEDS-REVIEW** — remaining 23 hits are intentional multi-z stacks (OfflineQueuePanel, AdminOperationsHub,
  DailyJSAForm, etc.) or template-literal/variant-prefixed shapes the codemod correctly skips.
- **FD-306 COMPLETE** — BrandedNavCard outer shells now use role `glass.*` tokens (emerald inner gradient kept custom).
- Verify: typecheck PASS. Surface gradient targets: **1** (Home login button accent only).

### 2026-06-06 (session 11) — full pending backlog drain
- **FD-305/320 COMPLETE** — ForemanDailyReports: all 10 freestyle blue panels → `glass.subtleBlue`/`glass.cardBlue`.
- **FD-304 COMPLETE** — AdminTelemetry 7 role-tinted metric panels → `glass.subtle*` tokens; AdminPremiumScaffold hero
  containers for gold/emerald/purple/red/blue → matching `glass.*` (ember theme hero left — no sanctioned ember token);
  FeaturePreviews phone mockup shells → `glass.cardEmerald`/`glass.subtleGold`; RiskCalibrationSection → role tokens.
- **FD-009/321/322 COMPLETE** — CrewStatusAnalytics + CrewOversightJobList + GeneralForemanDashboard → `glass.subtlePurple`/
  `glass.cardPurple`; table chrome off `bg-white/[0.0N]`.
- **FD-010/110/111/112 COMPLETE** — TeamContacts, IncidentLoggingModal, EmployeeAttendance, SafetyBriefingPage:
  `bg-white/[0.0N]` → `bg-gray-800`/`bg-gray-900`; briefing loading overlay → `glass.elevated` (removed backdrop-blur).
- **FD-120/121 COMPLETE** — DVIRTab + EquipmentTab: Framer `whileHover`/`whileTap` scale → CSS `hover:scale`/`active:scale`.
- Verify: typecheck PASS, eslint PASS. Remaining PENDING: FD-132 (hardZ semantic tail), FD-306 (BrandedNavCard NEEDS-REVIEW).

### 2026-06-06 (session 10) — FD-304 gold drain batch
- **FD-313 COMPLETE** — ManualAwardsHub: page hero panel → `glass.subtleGold` via `cn()`. gradient surfaces: 0.
- **FD-314 COMPLETE** — AdminUserActivity: session cards, filters, live feed → `glass.subtleGold`/`glass.cardGold`;
  feed header gradient → solid `bg-[#1b1812]/80`. gradient surfaces: 0.
- **FD-315 COMPLETE** — SafetyAnalyticsSection: user detail modal → `glass.subtleGold`; leaderboard + 3 stat
  panels → `glass.cardGold`. gradient surfaces: 0.
- **FD-316 COMPLETE** — UserRewardsDetailModal → `glass.subtleGold`. gradient surfaces: 0.
- **FD-317 COMPLETE** — AdminUsers (2nd pass): mobile card, delete modal, search panel, table shell →
  `glass.subtleGold`/`glass.cardGold`; table thead → `bg-[#1b1812]`. gradient surfaces: 0.
- **FD-318 COMPLETE** — AdminRTO: mobile request cards + filter panel → `glass.subtleGold`; main table shell →
  `glass.cardGold`; desktop thead gradient → solid `bg-[#1b1812]`. gradient surfaces: 0.
- **FD-319 COMPLETE** — AdminPartsFixesOverview: StatCard, AI summary inner panel, FilterBar → `glass.subtleGold`.
  Decorative gold orbs/CTA accents left intact. gradient surfaces: 0.
- **FD-304 tail:** AdminPremiumScaffold (gold hero uses bespoke gray-gold gradient), AdminTelemetry (role-tinted
  metric panels), FeaturePreviews, BrandedNavCard outer theme strings.
- Verify: typecheck PASS, eslint PASS. Build: bundle check still over limit (pre-existing main-index 270.9 KB > 250 KB).

### 2026-06-06 (session 9) — SafetyAnalyticsDashboard gold drain
- **FD-312 COMPLETE** — SafetyAnalyticsDashboard: user detail modal → `glass.subtleGold`; leaderboard +
  3 side panels (Points, Form Breakdown, Stats) → `glass.cardGold`. Verify: fd-gradients surface=0,
  typecheck PASS, eslint PASS.

### 2026-06-06 (session 8) — AdminJSA gold surface drain
- **FD-310 COMPLETE** — AdminJSA: filter panel + JSA detail modal → `glass.subtleGold`; main table
  container → `glass.cardGold`. Dropped `backdrop-blur-xl` on modal + table (off-system per guide §3).
  Text/accent/decoration gradients untouched. Verify: 0 inline hex surface gradients in file, typecheck
  PASS, eslint PASS.

- FD-001..005 completed during loop bring-up (first session).
- 2026-06-05 (this session): Added deterministic auditor `scripts/fd-audit.mjs` (`npm run fd:audit`).
  It replaces the directive's fuzzy `rg` scans. First run reconciled the queue against reality:
  - **FD-008 / FD-011 DISMISSED** — auditor surface=0. The raw `rg backdrop-blur` had counted
    sanctioned modal backdrops as drift. Phantom items removed from the queue.
  - **FD-006 NEEDS-REVIEW** — MechanicDVIRCenter's ember-glass header (surface=5) is an
    intentional mechanic-role treatment; flattening it to `glass.*` would destroy design intent.
  - **FD-012 DISMISSED** — OfflineModeBanner surface=0 and amber/blue is intentional per §16.
  - **FD-015 COMPLETE** — VoiceInputButton: `focus:ring`+`ring-offset-1` -> `focus-visible:ring-2`
    + `focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900`. Verify: tsc PASS, eslint PASS.
  - **FD-016 COMPLETE** — QuickFilterChips: removed 3 `whileHover`/`whileTap` scale pairs (chip,
    clear-all, date-range) -> CSS `hover:scale-* active:scale-*`. Verify: tsc PASS, eslint PASS.
  - **FD-1xx items** auto-derived from `npm run fd:audit --backlog` (top files per category).
- Current auditor totals (after FD-130 + FD-131): surface 329/96 files · **focusRing 0/0 (drained)** · hoverScale 89/34 · **hardZ 40/29 (was 83 — 43 converted, semantic tail remains)** · longMotion 530/142.

### 2026-06-05 (session 5) — COMPLIANCE-FORMS LENS (forms = product priority)
- **Why:** the generic 5 categories audit the whole repo but miss the issues that hurt field workers most
  *on the forms they fill out every shift*. Added a forms-first lens to the loop (directive: "Compliance-forms lens").
- **FD-200 COMPLETE — iOS input-zoom drained.** The LOCKED guide (§6, §11) requires `text-base` (16px) min on
  every field, because mobile Safari zooms the viewport on focus of any sub-16px input. The safety forms were
  full of `text-sm`/`text-xs` fields → a worker tapping a field on an iPhone 13 (P0 device) got a zoom +
  horizontal-scroll jolt mid-job. Fixed **39 field tokens across 14 files** -> `text-base`.
- **New tool:** `npm run fd:fix:input-zoom` (`scripts/fd-fix-input-zoom.ts`) — AST codemod (TS compiler API,
  no new deps; same approach as `fd:fix:zindex`). NOT line-detectable: an input's className is usually
  multi-line / `cn()`-wrapped / hoisted into a shared `baseInputClass` const. The codemod:
  - fixes inline classNames AND field-style **constants** (TreeFelling's `baseInputClass` = one edit fixing
    ~30 fields — the highest-leverage hit) — name contains `input`/`textarea` + real field signature (`w-full`
    + border/bg, so it never touches a label const);
  - only bumps the BARE size token (`text-sm`, never `md:text-sm` — desktop doesn't zoom); idempotent;
  - SKIPS only the genuine TemplateHead-splice hazard (reports it; nothing else is noise).
  - Verify: `npm run typecheck` PASS, `npm run lint` PASS, `npm run build` PASS (bundle check PASS), re-run = 0.
- **FD-201 COMPLETE — new `gradientSurface` auditor category.** Added to `scripts/fd-audit.mjs`. The `surface`
  rule only caught `bg-white/[0.0N]`/`backdrop-blur`; the forms hid their worst drift in multi-stop
  arbitrary-hex gradients (`bg-gradient-to-br from-[#0a2218] via-[#031510] to-[#010407]`) read as bespoke card
  backgrounds. Now surfaced: **304 hits / 78 files**. Stays MANUAL (which `glass.*` replaces a custom gradient
  is a design call) — FD-202/203 queued, top forms offenders first.
- **NearMiss already compliant** — its `inputBase` const already used `text-base` (it follows the guide); only
  a single inline field needed the bump. TreeFelling/DVIR/Equipment/JSA were the real debt.
- **FD-202 COMPLETE** — DailyEquipmentInspectionForm: all **6 inline hex-gradient surfaces** (1 hero + 5 form
  section panels) → `glass.cardEmerald` via `cn()`. Used the sanctioned emerald gradient token (already in
  `glass.ts`) instead of flattening to `glass.card`, to PRESERVE the form's intentional green identity while
  moving the surface onto the system source-of-truth. Conditional rose error borders on the two checklist
  cards are kept (twMerge overrides cardEmerald's border). Verify: auditor gradientSurface=0 for file,
  typecheck PASS, eslint PASS, build PASS (bundle PASS). gradientSurface total 304 → 298.
- **FD-203 DISMISSED** — stale: `node scripts/fd-audit.mjs --file DVIRForm.tsx` reports 0 (its focusRing was
  drained in session 3 and it has no inline gradient surfaces). The "off-system palette" note was not an
  auditor category, so there's nothing deterministic to action.
- **FD-204 COMPLETE** — ContactTemplatePicker: the `role="dialog"` panel's inline `bg-gradient-to-b
  from-[#0a1a10] to-black` → `glass.elevated` (the canonical modal/dialog surface per guide §3); emerald
  identity preserved via the accent icon. Verify: gradientSurface=0 for file, typecheck/eslint/build PASS.
- **Page-level compliance forms are now fully drained of inline gradient surfaces.** Remaining forms-scope
  gradient debt is 3 small component pickers (1 hit each): FD-205 DuplicateWarningModal, FD-206
  SavedLocationPicker, + ExampleJobForm (non-production sample, low priority). gradientSurface total now 297.

### 2026-06-05 (session 5 cont.) — forms gradient category fully drained + equipment surface pass
- **FD-205/206 COMPLETE** — the two picker dialogs (`role="dialog"`) moved off inline hex gradients to
  `glass.elevated` (the canonical modal surface, guide §3). DuplicateWarningModal keeps its amber warning
  identity via `border-amber-500/30` + top glow line (twMerge overrides glass.elevated's neutral border).
- **FD-207 DISMISSED** — ExampleJobForm's only gradient hit is a **gold CTA button**
  (`bg-gradient-to-r from-[#f7e4bd]… text-[#2e1b02] font-semibold`), not a surface, in a non-production
  sample file. Noted limitation: the `gradientSurface` rule can over-flag gradient *buttons*; left as-is
  rather than complicating the detector for one sample-file case.
- **FD-208 COMPLETE** — DailyEquipmentInspectionForm surface debt **15 → 2**. Swapped the bracket-form
  `bg-white/[0.0N]` backgrounds on inputs/selects/textarea/tiles/rows to the system tokens
  (`bg-gray-800`, rows `bg-gray-800/60`) per guide §3/§11 — surgical (background token only; borders/radius/
  layout untouched). The 2 remaining hits are decorative photo-overlay chips (the "Done" badge + "Retake"
  pill) that keep `backdrop-blur-sm` for legibility over the captured image — not major surfaces, left by design.
- **Verify (all of the above):** typecheck PASS, eslint PASS, build PASS (bundle PASS).
- **Note:** a `layoutRhythm` auditor rule (arbitrary spacing/radius off the 4px scale, 32 hits/19 files) was
  added in parallel this session — coexists with `gradientSurface`; respected, untouched.
- **Totals now:** surface 329 → 316 · gradientSurface 304 → 292 · focusRing 0 · hoverScale 89 · hardZ 40 ·
  layoutRhythm 32 · longMotion 530.

### 2026-06-05 (session 4) — context-aware hardZ codemod + missing Z infra
- **Found:** `src/lib/zIndex.ts` never existed — the `Z.*` system the guide mandates was docs-only. **Created it** with the locked scale (base/card/dropdown/sticky/offlineBanner/nav/modal/toast/tooltip).
- **New tool:** `npm run fd:fix:zindex` (`scripts/fd-fix-zindex.ts`) — a TS-compiler-API codemod (no new deps; uses installed `tsx`). hardZ is semantic (same `z-50` = modal/dropdown/FAB depending on context), so it classifies by className context and only converts unambiguous modal/dropdown/drawer shapes.
- **Safety rails (all verified via dry-run):** skips intentional stacks (>1 distinct z value/file → OfflineQueuePanel 60/61/62, dropdown portals 9998/9999, etc.), variant-prefixed tokens (`focus:z-50`), template-literal classNames, unclassifiable shapes, and any file it can't fully convert (partial = stacking inversion).
- **FD-131 COMPLETE** — 44 sites/37 files → `style={{ zIndex: Z.* }}` + auto-import. Verify: hardZ 83→40, tsc PASS, lint PASS.
- **Two codemod bugs caught by gates & fixed:** (1) line-based import insertion broke multi-line imports + dynamic `import()` → switched to AST anchor (last `ImportDeclaration`); (2) splicing a `TemplateHead` (ends in `${`) corrupted template classNames → now skipped. Recovered affected files by revert + idempotent re-run of both tools.
- **FD-132 PENDING** — ~40 hardZ remain (the intentionally-skipped semantic tail) for the manual one-per-tick loop.
- Replenish: run `npm run fd:audit -- --backlog` and append the top untracked rows when PENDING drops below ~3.

### 2026-06-05 (session 3) — auditor gains a deterministic `--fix` mode
- **New capability:** `npm run fd:audit -- --fix` (see `scripts/fd-audit.mjs` `SAFE_FIXERS`). Auto-fixes
  ONLY mechanical, judgment-free categories. Currently: `focusRing` (the LOCKED a11y rule).
  - Transforms: `focus:ring*` -> `focus-visible:ring*`, `focus:border*` -> `focus-visible:border*`
    (keyboard-only per guide §11), `ring-offset-black` -> `ring-offset-gray-900`. Idempotent.
  - `--fix --dry-run` previews; `--fix --category <c>` / `--fix --file <p>` scope it.
  - REFUSES `surface`/`hoverScale`/`hardZ`/`longMotion` — those need design judgment (which `glass.*`
    variant, which `Z.*`, whether motion is intentional) and stay in the one-item-per-tick loop.
- **FD-130 COMPLETE** — ran `--fix --category focusRing` repo-wide: 309 lines across 84 files.
  Verify: `npm run fd:audit` focusRing = **0**, `npm run typecheck` PASS, `npm run lint` PASS.
  This drains the entire HIGH severity category in one deterministic pass instead of ~76 ticks.
- **FD-101 COMPLETE** (done manually first, full pattern incl. `focus-visible:ring-offset-2`); the
  remaining 75 files were swept by the autofix. **FD-102/103/104 COMPLETE** via the same sweep.
- **FD-105** downgraded to z-index-only: its 10 focus rings are fixed; 4 hardcoded z-index remain (hardZ is manual).
- **Loop leverage learning:** the highest-severity category was 100% mechanical. Pushing it into Layer-3
  code (per AGENTS.md) cleared it instantly and made the gate self-verifying (audit must report 0).
  Next mechanical candidate to consider automating: `hardZ` (`z-50`/`z-[NNN]` -> `Z.*`) is *partially*
  mechanical but needs an import insertion + inline-style conversion, so it's left manual for now.
