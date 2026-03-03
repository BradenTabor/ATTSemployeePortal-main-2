---
name: scaffold-safety-form
description: Scaffold a complete ATTS safety form — state file, validation hook, submission hook, photo upload hook, page component with wizard steps, barrel export, and E2E test stub — all following the established DailyJSA 6-file architecture with offline-first and OSHA compliance patterns.
triggers:
  - "create a new form"
  - "add a form"
  - "scaffold form"
  - "new inspection form"
  - "new report form"
  - "new JSA"
  - "new DVIR"
version: 1.0
reviewed: 2026-02-17
---

# Scaffold Safety Form

## Purpose
Creates all 6 coordinated files required for a new safety/inspection form in the ATTS Employee Portal. Skipping or deviating from this pattern breaks offline sync, audit logging, and telemetry.

## Pre-Flight Checklist
Before writing any files, collect:
- [ ] `<FormName>` — PascalCase (e.g., `HazardAssessment`)
- [ ] `<domain>` — kebab-case folder name under `src/hooks/` (e.g., `hazard-assessment`)
- [ ] `<tableName>` — snake_case Supabase table (e.g., `hazard_assessments`)
- [ ] Wizard steps — list each step name and its fields
- [ ] Photos required? (yes/no) — if no, skip File 4
- [ ] Offline required? (assume yes unless explicitly told no)

---

## Step-by-Step Workflow

### File 1 — Form State (`src/pages/forms/<Name>FormState.ts`)

See `references/form-state-template.md` for full template.

Key rules:
- Export `<Name>FormState` type — one field per form input, typed strictly (no `any`)
- Export `createInitial<Name>FormState(): <Name>FormState` — must return a fully populated default object (no undefined fields)
- Export all domain constants as `const` objects, not enums (e.g., `HAZARD_TYPES`, `SEVERITY_LEVELS`)
- Export `transform<Name>ForSubmission(state: <Name>FormState): <TableInsertType>` — this is where `as` casts are acceptable ONLY with a comment explaining why
- Keep this file free of React imports — pure TS only

### File 2 — Validation Hook (`src/hooks/<domain>/use<Name>FormValidation.ts`)

See `references/validation-hook-template.md`.

Key rules:
- Call `useFormValidation(rules: ValidationRule[])` from `@/hooks/useFormValidation`
- Each `ValidationRule` has: `field`, `required`, `validate?: (val, state) => string | null`
- Export only the hook, nothing else
- Never inline regex — import from `@/lib/validation` or define as a named const above the hook

### File 3 — Submission Hook (`src/hooks/<domain>/use<Name>Submission.ts`)

See `references/submission-hook-template.md`.

Key rules:
- Always branch: `if (isOnline()) { ... } else { await addToQueue(...) }` — import both from `@/lib/offlineQueue`
- Online path: call Supabase insert → handle error with `parseFormError()` from `@/lib/errorHandling`
- Offline path: serialize state, call `addToQueue('<form_name>', payload, { userId })` (use `'high'` priority only for incident reports)
- Always call `trackFormSubmitted()` or `trackFormSubmitError()` from `@/lib/telemetry` — never skip
- Always call `logger.info/error` from `@/lib/logger` — never use `console.log`
- Show success with `formToast.success()` (overlay), NOT `toast()` (Sonner) — submissions use formToast
- On success, call `queryClient.invalidateQueries({ queryKey: queryKeys.<entity>.all })`

### File 4 — Photo Upload Hook (`src/hooks/<domain>/use<Name>PhotoUpload.ts`)

Skip this file entirely if no photos required. See `references/photo-hook-template.md`.

Key rules:
- Compress before upload (use existing `compressImage()` utility — do NOT implement your own)
- Upload to Supabase Storage bucket `form-photos/<formName>/`
- On upload failure: rollback already-uploaded photos, surface error via `parseFormError()`
- Return `{ photos, uploadPhoto, removePhoto, isUploading, uploadError }`
- Never store raw File objects in form state — store upload URLs only

### File 5 — Page Component (`src/pages/forms/<Name>Form.tsx`)

See `references/page-component-template.md`.

Key rules:
- Wrap entire page in `<DashboardLayout>` — no exceptions
- Use wizard steps via local `step` state (integer index) with `<ProgressIndicator>`
- Persist draft to localStorage with key `'atts_<formName>_draft'` on every field change
- Clear draft on successful submission
- Call `trackFormStarted()` in a `useEffect` on mount — once only
- Import all hooks from the domain barrel (`@/hooks/<domain>`)
- Load state from `createInitial<Name>FormState()` — never define initial state inline
- Error display: use `<FormErrorBanner>` component, not inline JSX
- The component should be under 400 lines. If it goes over, the wizard steps should be split into `<Step1/>`, `<Step2/>` sub-components in the same file

### File 6 — Barrel Export (`src/hooks/<domain>/index.ts`)

```ts
// src/hooks/<domain>/index.ts
export { use<Name>FormValidation } from './use<Name>FormValidation';
export { use<Name>Submission } from './use<Name>Submission';
export { use<Name>PhotoUpload } from './use<Name>PhotoUpload'; // omit if no photos
```

If the domain folder is new, also add the domain to `src/hooks/index.ts` if one exists.

---

## After Creation — Validation Checklist

Run these checks before closing the task:

- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] `createInitial<Name>FormState()` returns a value with zero `undefined` fields
- [ ] Submission hook has both online AND offline branches
- [ ] `trackFormStarted` is called on mount, `trackFormSubmitted`/`trackFormSubmitError` on submit
- [ ] No `console.log/warn/error` — only `logger.*`
- [ ] Draft key is unique (search codebase for `atts_` to confirm no collision)
- [ ] Barrel export includes all new hooks
- [ ] File 5 (page component) is imported in `src/App.tsx` as a lazy route

---

## Anti-Patterns — Never Do These

- **Never** define form state inline in the page component
- **Never** call Supabase directly from a page component — always via a hook
- **Never** use `toast()` (Sonner) for form submission feedback — use `formToast`
- **Never** skip the offline branch — even if "this form doesn't need offline right now"
- **Never** use `console.*` — use `logger.*`
- **Never** skip telemetry calls — they feed the compliance audit trail
- **Never** name the draft key anything other than `atts_<camelCaseName>_draft`

---

## E2E Test Stub

Create `e2e/<formName>.spec.ts` using the template in `references/e2e-test-stub.md`. At minimum scaffold:
- Auth setup (reuse `e2e/fixtures/auth.ts`)
- Happy path: fill form → submit → assert success toast
- Mark complex scenarios as `test.skip('TODO: ...')` rather than leaving them absent
