# Refactor & Form-Draft Conventions

Short rules from the `useFormDraftLifecycle` migration (DVIR, Equipment, JSA). Every item points at code that exists today — extend these patterns; do not reinvent parallel lifecycles.

---

## Commit discipline

**Fix and refactor never share a commit.** A behavior change and a structure change are separate commits even when they touch the same file.

Real sequence from this work:

| Order | SHA | What |
|-------|-----|------|
| 1 | `633ac57` | **Fix** — `markAsSaved` cancels pending debounce and updates saved-form ref (`useFormPersistence.ts` + tests) |
| 2 | `120d97a` | **Feat** — `useFormDraftLifecycle` hook (test-first, not wired) |
| 3 | `6cfe015` | **Fix** — DVIR template beats stale draft (`incomingTemplateRef` + `DVIRTemplatePrecedence.integration.test.tsx`) |
| 4 | `a61db77` | **Refactor** — DVIRForm migrates to the hook |
| 5 | `8bffb4a` | **Fix (security)** — admin-only gate on risk-calibration at render |
| 6 | `34050d9` | **Chore** — remove dead `/admin/risk-calibration` route |

Rule: land the primitive fix and its contract tests first; land precedence/behavior fixes before the migration that depends on them; land security fixes before dead-code removal that touches the same surface.

---

## Analysis before implementation

For anything touching untested, shared, or critical code: **map current behavior before changing it.**

- Each form migration started with a copy-grep / recon pass across `DailyJSAForm.tsx`, `DailyEquipmentInspectionForm.tsx`, and `DVIRForm.tsx` — documented in the header of `src/hooks/useFormDraftLifecycle.ts` (identical toasts, `beforeunload` copy, which params were dropped as speculative).
- **"Behavior-preserving" means tests pass unmodified.** The precedence integration tests are the contract — do not rewrite them to match a new implementation; make the implementation match them.
  - `tests/unit/components/DVIRTemplatePrecedence.integration.test.tsx` — template vs draft (`6cfe015`)
  - `tests/unit/components/JSADuplicatePrecedence.integration.test.tsx` — duplicate vs draft (`517de17`)

---

## `useFormDraftLifecycle` (`src/hooks/useFormDraftLifecycle.ts`)

Shared orchestration on top of `useFormPersistence`. **Hook owns:** 60s silent auto-restore, delayed recovery modal, empty-draft discard, autosave, flush-on-unmount, `beforeunload`, restore/dismiss handlers, `draftRecoveryModalProps`.

**Page still owns:** submit flow, template/duplicate sessionStorage handlers, wizard navigation, edit-mode record load, celebration UI.

### Config knobs (add only when a form actually diverges)

| Option | When to use |
|--------|-------------|
| `draftRecoveryEnabled` | **Master gate.** Set `false` when another path owns the form (incoming template/duplicate). Subordinates `enableAutoRestore`. Added in `eae5144`. |
| `enableAutoRestore` | Page computes e.g. `!isEditMode && !hasIncomingTemplate`. Hook does not read sessionStorage. |
| `enableAutosave` | `false` in JSA edit mode (`enableAutosave: !isEditMode`). |
| `applyFormFromDraft` | Equipment only — passes `normalizeFormStateFromDraft` so restore matches legacy inline behavior. |
| `hasUnsavedPhotos` | Callback so hook stays photo-agnostic; DVIR + Equipment pass it; JSA omits (no photo branch). |
| `blockWhen` | Suppress `beforeunload` during celebration (`showCelebration`). |
| `restoredToastMessage` | Only toast body that genuinely differs per form. |

**Do not add config speculatively.** The copy audit dropped `toastMessages`, `photoWarningMessage`, and `formWarningMessage` — three of four proposed params never shipped because all three pages were identical.

### Reference implementations

- **DVIR** (`src/pages/forms/DVIRForm.tsx`) — template handoff, `draftRecoveryEnabled: !hasIncomingTemplate`, photos + celebration gates.
- **Equipment** (`src/pages/forms/DailyEquipmentInspectionForm.tsx`) — `applyFormFromDraft: normalizeFormStateFromDraft`, no cross-page precedence flag.
- **JSA** (`src/pages/forms/DailyJSAForm.tsx`) — wizard + edit mode + duplicate handoff, `draftRecoveryEnabled: !isEditMode && !hasIncomingDuplicate`, `enableAutosave: !isEditMode`.

---

## Precedence-flag pattern (sessionStorage vs draft)

When a cross-page handoff ("Use as Template" / "Duplicate") must beat a recovered draft:

1. **Freeze the flag in the render body** — lazy-init ref read on first render, before any effect runs.
2. **Gate `draftRecoveryEnabled`** on that flag so the hook stands down entirely (no auto-restore, no modal, no empty-draft discard).
3. **Do not rely on effect declaration order or async timing.**

References:

- `incomingTemplateRef` in `src/pages/forms/DVIRForm.tsx` (reads `sessionStorage['dvir-template']`) — fixed latent bug where auto-restore overwrote template because mount effects raced (`6cfe015`).
- `incomingDuplicateRef` in `src/pages/forms/DailyJSAForm.tsx` (reads `sessionStorage['jsa-duplicate']`, scoped to `!id`) — same class of bug for duplicate-from-history (`517de17`).

Template/duplicate **consumption** stays in page effects; the hook only receives the boolean gate.

---

## Test layers (extend, don't duplicate)

| File | Scope |
|------|--------|
| `tests/unit/useFormPersistence.test.tsx` (28 cases) | Storage, debounce, expiry, `markAsSaved` timer cancellation |
| `tests/unit/useFormDraftLifecycle.test.tsx` (18 cases) | Lifecycle orchestration + gate behavior (`draftRecoveryEnabled`, autosave, modal) |
| `tests/unit/components/*Precedence.integration.test.tsx` | Component-level precedence contracts — must stay green across refactors |
| `src/sw.ts` | **Not** covered by Vite prod `esbuild.drop: ['console']` (`vite.config.ts` line ~180). Omit or gate `console.*` in service-worker code manually (`32ceb1d` removed `console.log` that had shipped). |

When adding a fourth form to the hook: add precedence tests **before** migration if the page has sessionStorage handoff; extend hook tests only for genuinely new gate behavior.
