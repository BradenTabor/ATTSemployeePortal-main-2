# Directive: Continuous Frontend-Design Improvement Loop

> Layer 1 (Directive). Orchestrated by the agent each time the `/loop` heartbeat
> fires the `AGENT_LOOP_TICK_fd` sentinel. One backlog item per tick.

## Goal

Incrementally raise the visual/UX quality of the ATTS Employee Portal by applying
the **frontend-design** skill's design-thinking lens **within** the locked ATTS
design system (`.cursor/skills/ui-design-guide/SKILL.md`). Each iteration takes
exactly one item to DONE with passing gates — never a sweeping multi-file rewrite.

## Inputs

- `directives/frontend-design-backlog.md` — the FD work queue (this loop's source of truth).
- `scripts/fd-audit.mjs` (`npm run fd:audit`) — the **deterministic auditor + autofixer** (Layer 3). It is the
  authoritative source for violation counts and target selection. It excludes design-system-sanctioned
  patterns (modal `bg-black/* backdrop-blur-sm`, skeleton `animate-pulse`, the `glass.ts`/`animations.ts`
  source files) that a raw `rg` over-counts. Categories: `surface`, `focusRing`, `hoverScale`, `hardZ`, `longMotion`.
  It also has a **`--fix` mode** (`npm run fd:audit -- --fix`) that mechanically resolves judgment-free
  categories repo-wide in one pass. See "Deterministic mass-fix" below.
- `.cursor/skills/ui-design-guide/SKILL.md` — the LOCKED system (surfaces, motion, z-index, roles). Authoritative; overrides the generic skill's defaults.
- `~/.claude/plugins/.../frontend-design/SKILL.md` — design-thinking lens (typography, color, motion, spatial, atmosphere).
- `src/lib/glass.ts`, `src/lib/animations.ts` — shared tokens to reuse (never freestyle major surfaces).
- `scripts/fd-fix-input-zoom.ts` (`npm run fd:fix:input-zoom`) — the **compliance-forms input codemod** (Layer 3).
  AST-based (TS compiler API, like `fd:fix:zindex`). Detects + fixes the iOS-zoom bug: sub-16px text on
  `<input>/<select>/<textarea>`. See "Compliance-forms lens" below.
- `scripts/fd-gradients.mjs` (`npm run fd:gradients`) — the **gradient palette analyzer** (Layer 3). Classifies
  every inline hex gradient by role (text/accent/border/decoration/surface) and maps true surfaces to the
  nearest `glass.*` token, flagging color families with no token. The precise driver for the color-gradient
  lens below — use it instead of the raw `gradientSurface` line count when picking a target.
- `scripts/fd-page.mjs` (`npm run fd:page -- <page>`) — the **page-bundle auditor** (Layer 3). Runs
  fd:audit + fd:gradients + fd:fix:input-zoom across a route file and its statically-imported local
  components (one hop). Also emits **page composition hints** (search buried in collapsibles, inline style
  gradients, infinite hero motion). Use this when the user names a page (e.g. Announcements) instead of
  grinding repo-wide category totals — see "Page-bundle lens" below.

## Compliance-forms lens (PRIORITY — forms are the product)

The safety forms (DVIR, Daily JSA, Tree Felling JSA, Daily Equipment Inspection, RTO, Near Miss) are the
core of the product and the heaviest design-system offenders, yet the generic 5 categories miss the issues
that hurt field workers most. Drain these forms-specific categories FIRST.

- **`inputZoom` (HIGH, LOCKED) — the #1 forms win.** Mobile Safari zooms the viewport whenever a focused
  field's font-size is < 16px. The guide (§6, §11) requires `text-base` on every field; the forms were full
  of `text-sm`/`text-xs` inputs, so a worker tapping a field on an iPhone 13 (P0 device) got a jarring zoom +
  horizontal scroll mid-job. This is NOT line-detectable (an input's className is usually multi-line / wrapped
  in `cn()` / hoisted into a shared `baseInputClass` const), so it has a dedicated AST codemod:
  ```bash
  npm run fd:fix:input-zoom -- --forms              # dry-run REPORT (default), forms scope
  npm run fd:fix:input-zoom -- --forms --write      # apply: bump sub-16px field tokens -> text-base
  npm run fd:fix:input-zoom -- --file <path>        # scope to one file
  ```
  It fixes inline classNames AND field-style constants (`baseInputClass`/`inputBase`/… — name contains
  `input`/`textarea` + a real field signature `w-full` + border/bg). It only touches the BARE size token
  (`text-sm`, not `md:text-sm` — desktop never zooms), is idempotent (`text-base` re-run is a no-op), and
  SKIPS only the genuine TemplateHead-splice hazard. Gate after `--write`: `typecheck` + `eslint` changed files.
- **`gradientSurface` (MED) — manual, one per tick.** `npm run fd:audit -- --category gradientSurface`.
  The `surface` rule catches `bg-white/[0.0N]` + `backdrop-blur`, but the forms hide their worst drift in
  multi-stop arbitrary-hex gradients (`bg-gradient-to-br from-[#0a2218] via-[#031510] to-[#010407]`) used as
  bespoke card backgrounds. Replacing these needs design judgment (which `glass.*`, or a role-themed variant
  added to `@/lib/glass`) so it stays in the manual loop — never freestyle a new gradient.
  **Use the gradient palette analyzer (below) to pick the right token — it is far more precise than the raw line count.**

## Color-gradient lens — the palette analyzer (`npm run fd:gradients`)

The raw `gradientSurface` count is noisy: it lumps together text gradients (`bg-clip-text`), button/badge
fills, decorative blur orbs, gradient borders, and actual card **surfaces** — but only the SURFACES are drift
`glass.*` should own. `scripts/fd-gradients.mjs` (Layer 3) classifies every `bg-gradient-to-* from-[#hex]`
by ROLE, and for true surfaces clusters them by color FAMILY and maps each to the nearest sanctioned token:

```bash
npm run fd:gradients               # summary: hits by role + surfaces grouped by target token
npm run fd:gradients -- --plan     # consolidation plan: every surface cluster -> its glass.* token
npm run fd:gradients -- --missing  # ONLY clusters with no token yet (new-token candidates)
npm run fd:gradients -- --surfaces # surface gradients ranked by file (pick a tick target)
npm run fd:gradients -- --file <p> # per-line role classification for one file
```

How to use it in a tick:
1. `--missing` first. If a whole role-color family of surfaces has **no token**, the highest-leverage move is
   to ADD the token to `@/lib/glass.ts` (sanctioned by the guide §"Surface System": "add it to glass.ts — do
   not use it inline"). Base the token on the DOMINANT existing hex signature so the visual identity is
   preserved exactly — never reinvent the color. This single additive edit gives dozens of freestyle surfaces a
   home. (Done 2026-06-05: added `cardGold`/`subtleGold`/`cardBlue`/`subtleBlue` — admin & foreman had none.)
2. Then `--surfaces` / `--file` to pick a file and replace the freestyle gradient with the token via `cn()` or a
   template literal. Prefer files with IDENTICAL repeated surfaces (e.g. 3 identical modals) — those are the
   most faithful, lowest-risk consolidations.
3. NEVER touch `text`/`accent`/`border`/`decoration` roles — those are intentional. Only `surface`.

## Page-bundle lens — scoped route improvement (`npm run fd:page`)

When the user names a **page** (not a repo-wide category), run the page bundle BEFORE picking a backlog
item. This is the concrete workflow for improving gradients, layout, and organization on one route:

```bash
npm run fd:page -- src/pages/Announcements.tsx   # or: npm run fd:page -- Announcements
npm run fd:page -- Announcements --depth 2       # follow imports two hops
```

The script:
1. Resolves the page file (accepts `Announcements`, `src/pages/Announcements.tsx`, etc.).
2. Collects the page + locally-imported components (default depth 1).
3. Runs per-file `fd:audit`, `fd:gradients`, and `fd:fix:input-zoom` (dry-run).
4. Prints **composition hints** — patterns the category auditors miss:
   - Search/filter controls nested inside `ExpandableSection` (move to page-level toolbar).
   - Inline `style={{ background: linear-gradient(...) }}` on surfaces (→ `glass.*`).
   - Infinite Framer motion >200ms on hero cards (→ static decoration or CSS, gate with `getDeviceCapabilities()`).
   - Framer `whileHover` scale (→ CSS `hover:scale-*`).

**Fix order for a page tick:** inputZoom → gradientSurface/surface → **layout reorganization** (composition
hints) → layoutRhythm → hoverScale → longMotion (hero simplification). One cohesive page pass may touch
≤3 files (page + modal + shared card) if they share the same bundle.

**Example (Announcements, 2026-06-06):** fd:page flagged search-in-collapsible + 5 longMotion hits on the
featured hero. Fixed by: page-level search/sync toolbar in `glass.subtleEmerald`, featured card on
`glass.cardEmerald` (removed inline inner gradient + 12s conic ring + floating orb loops), feed cards
CSS hover lift, pagination on `glass.subtleEmerald`, modal sparkle static + title `bg-clip-text`.

## Layout/organization lens — `layoutRhythm` (`npm run fd:audit -- --category layoutRhythm`)

The spacing scale (`gap-1..8`, guide §8) and radius system (`rounded-lg/xl/2xl/full`, guide §4) create a
consistent visual rhythm. Arbitrary px values (`gap-[7px]`, `p-[13px]`, `rounded-[10px]`) drift off that grid
and make sibling surfaces subtly misaligned. The `layoutRhythm` category flags spacing/radius UTILITIES that
take an arbitrary length. It deliberately does NOT flag arbitrary positions (`top-`/`-translate-`) or sizes
(`w-`/`h-`) — those are legitimately bespoke — nor `calc()`/`env()` safe-area insets or negative margins
(intentional bleed). Manual, one per tick: round each arbitrary value to the nearest scale step that preserves
the layout, or justify + skip if the exact value is load-bearing.

## Deterministic mass-fix (do this BEFORE grinding ticks)

Some categories are 100% mechanical — the correct replacement carries no design judgment. For these,
do NOT hand-fix one file per tick; that wastes the loop on rote edits. Instead resolve the whole
category in one deterministic pass:

```bash
npm run fd:audit -- --fix --category focusRing --dry-run   # preview blast radius
npm run fd:audit -- --fix --category focusRing             # apply repo-wide
npm run fd:audit                                            # category must now read 0
npm run typecheck && npm run lint                           # hard gates
```

- **Auto-fixable today:** `focusRing` (the LOCKED a11y rule). Fixers live in `SAFE_FIXERS` in
  `scripts/fd-audit.mjs` and are idempotent.
- **Context-aware codemod:** `hardZ` is NOT a simple text swap (the same `z-50` is a modal here, a
  dropdown there), so it has a dedicated AST codemod, `npm run fd:fix:zindex` (`scripts/fd-fix-zindex.ts`):
  ```bash
  npm run fd:fix:zindex            # dry-run: classify modal/dropdown/drawer, report skips
  npm run fd:fix:zindex -- --write # apply the safe subset -> style={{ zIndex: Z.* }} + import
  ```
  Another context-aware codemod is `npm run fd:fix:input-zoom` for the compliance-forms `inputZoom`
  category (see "Compliance-forms lens" above) — AST-based detect+fix, dry-run by default.
  It classifies each site by className context, and SKIPS (for the manual loop) intentional stacks
  (>1 distinct z value in a file), variant-prefixed tokens (`focus:z-50`), template-literal classNames,
  unclassifiable shapes (FABs, tooltips), and any file where it can't convert *every* site (partial
  conversion would invert relative stacking). After `--write`, run `npm run fd:audit -- --category hardZ`
  then `typecheck` + `lint`. The remaining ~40 hardZ hits are the intentionally-skipped semantic tail.
- **NOT auto-fixable (stay manual, one per tick):** `surface` (which `glass.*`?), `hoverScale`
  (is the motion intentional?), `longMotion` (is the duration deliberate?), plus the `hardZ` tail above.
- When you discover another category becomes mechanical, add a fixer to `SAFE_FIXERS` (or a dedicated
  codemod for context-sensitive ones) with a dry-run + gate verification — don't expand the manual queue.

## Procedure (one tick)

1. **Select** the top `PENDING` item in `frontend-design-backlog.md` (highest Sev, lowest Effort to break ties). If none remain, run a fresh scan (step 6) and stop if still empty. If the top item belongs to an auto-fixable category, prefer the deterministic mass-fix above over a single tick.
2. **Read** the target file(s) and confirm the issue still exists with `node scripts/fd-audit.mjs --file <path>` (prints exact line numbers). If the auditor reports 0 for that file, the item is stale — mark it `DISMISSED` and move to the next.
3. **Apply** the fix using shared tokens (`glass.*`, `animationVariants`, role accents). Honor the hard rules:
   - Surfaces: `glass.*` — no `backdrop-blur` / `bg-white/[N]` on major surfaces.
   - Motion: ≤200ms, `useReducedMotion`-guarded, no particle fields / animated blobs / infinite GPU churn.
   - Focus: `focus-visible:` (never `focus:`), `ring-offset-gray-900`.
   - Z-index, fonts (system stack), radii per guide.
   - Never change role-accent semantics or copy meaning without justification.
4. **Verify gates** (hard stop on failure):
   ```bash
   npm run typecheck && npx eslint <changed files>
   node scripts/fd-audit.mjs --file <path>   # must now report 0 for the fixed category
   ```
   Fix anything introduced. Do not leave the tree broken.
5. **Log**: mark the item `COMPLETE` in `directives/frontend-design-backlog.md` and add a dated bullet under its `## Notes` (ID, summary, files, verify result). Also append a row to `docs/cursor-agents/changelog.md` *if writable* — new-file creation under `docs/cursor-agents/` may be blocked in some environments, but editing the existing `changelog.md` via in-place edit is fine; if it errors, the backlog is the system of record.
6. **Replenish** (only when the queue is low): regenerate accurate, scoped, deduplicated rows
   from the deterministic auditor and append the top untracked ones:
   ```bash
   npm run fd:audit              # human summary: ranked files per category
   npm run fd:audit -- --backlog # paste-ready "| FD-NNN | Sev | … | PENDING |" rows
   npm run fd:audit -- --json    # machine-readable, for tooling
   ```
   Prefer the highest-count file in the highest-severity category. `focusRing` (HIGH) is a LOCKED
   accessibility requirement — drain it before `surface` (MED) and `hoverScale` (LOW).
   Do NOT re-add the legacy `rg` scans; they over-count sanctioned modal backdrops and skeletons.

## Output

- A single committed-quality change per tick (lint + typecheck green).
- Updated `frontend-design-backlog.md` + `changelog.md`.

## Guardrails

- One item per tick. Blast radius ≤ ~3 files; if larger, split into sub-items.
- Never touch LOCKED elements (DashboardLayout, `glass.ts`/`animationVariants.ts` constant *values*, role colors, nav heights) — see ui-design-guide "Beautify Mode — Locked vs Unlocked".
- If a fix is ambiguous or changes product meaning, mark the item `NEEDS-REVIEW` and skip to the next, rather than guessing.
- Stop the loop if two consecutive ticks fail gates (signals a systemic problem to surface to the user).

## Stop

Kill the tracked loop PID. Do not arm another heartbeat.
