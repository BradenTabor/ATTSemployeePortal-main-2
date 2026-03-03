---
name: project-conventions
description: ATTS Employee Portal architecture overview, file organization, naming conventions, established patterns, and critical do/don't rules. Load before generating any code to ensure consistency with the existing codebase.
triggers:
  - "implement feature"
  - "generate code"
  - "follow project conventions"
  - "add feature"
  - "refactor"
  - "create component"
  - "write code for"
  - any task that produces .ts, .tsx, or .sql files
version: 1.0
reviewed: 2026-02-17
---

# ATTS Employee Portal — Project Conventions

## What This App Does
ATTS Employee Portal is an offline-first safety management PWA for field workers. Workers submit OSHA-compliant safety forms (JSAs, DVIRs, inspections, incident reports) from mobile devices, including in areas with no connectivity. The offline-first requirement is not a nice-to-have — it is a core compliance requirement.

---

## Architecture at a Glance

```
src/
  components/       UI components, organized by domain
    admin/          Admin-specific components
    dashboard/      Dashboard widgets
    layout/         DashboardLayout and navigation
    ui/             Shared primitives (Button, Input, etc.)
  contexts/         React contexts (OfflineQueueContext, AuthContext)
  hooks/            All business logic lives here — never in components
    queries/        TanStack Query data-fetching hooks
    <domain>/       Domain-specific hooks (jsa/, dvir/, forms/, etc.)
  lib/              Utilities, clients, constants
  pages/            Route-level components only — thin wrappers over hooks
    admin/          Admin pages
    forms/          Form page components + their FormState.ts files
  types/            Global TypeScript types
  
supabase/
  functions/        Deno Edge Functions
  migrations/       SQL migrations (169 files)
```

**Path alias:** `@/` maps to `src/`. Always use this — never relative `../../`.

---

## Layer Rules

### Components
- **Components are display-only.** No Supabase calls, no business logic.
- All data fetching goes through hooks (`use*` in `src/hooks/`)
- All pages are wrapped in `<DashboardLayout>` — no exceptions
- Component files: PascalCase (e.g., `SafetyIncidentCard.tsx`)

### Hooks
- Custom hooks live in `src/hooks/<domain>/` or `src/hooks/queries/`
- Each domain folder has an `index.ts` barrel export
- Hook files: camelCase with `use` prefix (e.g., `useJsaSubmission.ts`)
- Hooks own all side effects: API calls, localStorage, telemetry, logging

### Pages
- Pages are thin: import hooks, wire up to components, nothing else
- State initialization always uses `createInitial<Form>FormState()` — never inline
- Route definitions live in `src/App.tsx` as lazy-loaded components

### Lib
- `src/lib/supabaseClient.ts` — single Supabase client instance
- `src/lib/queryKeys.ts` — all React Query cache keys (centralized)
- `src/lib/errorHandling.ts` → `parseFormError()` — normalizes all errors
- `src/lib/logger.ts` → `logger.info/warn/error()` — structured logging
- `src/lib/telemetry.ts` → `trackForm*()` — compliance telemetry
- `src/lib/formToast.ts` → `formToast.*()` — form-specific overlays
- **Never import Supabase directly except in hooks and lib files**

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase | `SafetyIncidentCard.tsx` |
| Hooks | camelCase, `use` prefix | `useJsaSubmission.ts` |
| Pages | PascalCase, `Page` or form name | `DailyJSAForm.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Types/Interfaces | PascalCase | `FormState`, `UserRole` |
| DB tables | snake_case, plural | `daily_jsas` |
| DB columns | snake_case | `submitted_by`, `created_at` |
| Query keys | camelCase entity | `queryKeys.dailyJsa` |
| Draft storage | `atts_<camelCase>_draft` | `atts_dailyJsa_draft` |
| Constants | SCREAMING_SNAKE_CASE | `HAZARD_TYPES` |
| Barrel files | `index.ts` in each domain folder | |

---

## The Toast Rule — Critical

There are TWO toast systems. Using the wrong one is a bug.

| System | Import | Use For |
|---|---|---|
| `formToast` | `@/lib/formToast` | Form submission results (success, error, queued) |
| `toast` (Sonner) | `sonner` | General notifications (not form submissions) |

Always use `formToast` for anything that happens after pressing "Submit".

---

## The Logger Rule — Critical

**Never use `console.log`, `console.warn`, or `console.error` in production code.**

Always use `logger.*` from `@/lib/logger`:

```ts
import { logger } from '@/lib/logger';

logger.info('User submitted JSA', { userId, jsaId });
logger.warn('Offline queue at capacity', { queueSize });
logger.error('Supabase insert failed', { error, formName });
```

There are currently 50+ `console.*` calls in production code — this is a known tech debt. Do not add more.

---

## Telemetry — Required for Forms

Every form must call:
- `trackFormStarted('<FormName>')` — once on mount
- `trackFormSubmitted('<FormName>', metadata)` — on successful submit (online or offline)
- `trackFormSubmitError('<FormName>', { error })` — on any submit failure

Import from `@/lib/telemetry`. These feed the OSHA compliance audit trail.

---

## Offline-First Architecture

The offline system is non-negotiable:
- `isOnline()` from `@/lib/offlineQueue` — returns `boolean` (function, not a hook)
- `addToQueue(type, payload, metadata)` from `@/lib/offlineQueue` — enqueues for sync
- `OfflineQueueContext` manages sync lifecycle and form-specific submitters
- All form submission hooks must branch on `isOnline()`
- Priority: `'high'` for incidents/near-miss, `'normal'` for everything else
- Photo uploads: handled separately by photo upload hooks, stored as URLs in form state

Do not implement offline logic differently from the established pattern. See `scaffold-safety-form` skill for the exact submission hook template.

---

## Supabase Patterns

- Single client: `import { supabase } from '@/lib/supabaseClient'`
- Always check `if (error) throw new Error(error.message)` after queries
- Always map raw DB rows to app types via `to<Entity>()` mapper functions
- Never return Supabase row types to components
- RLS is enabled on all tables — queries that return empty arrays unexpectedly are usually RLS issues, not bugs

---

## TypeScript Rules

- `strict: true` is enforced — no `any` without a comment
- Prefer `interface` over `type` for object shapes
- Prefer `const` objects over `enum` (Zod compatibility)
- Generic form state pattern: `FormState[K]` typed updates — see form templates
- `as` casts are acceptable only in `transform*ForSubmission()` functions with an explanatory comment

---

## What Lives in .cursor/rules/ (Don't Duplicate)

The project already has 7 specialist rules:
- `UX.mdc` — UI/interaction standards
- `Workflow.mdc` — development workflow
- `Architecture.mdc` — structural decisions
- `Performance.mdc` — performance budgets and patterns
- `QA.mdc` — testing standards
- `Security.mdc` — security and RLS patterns
- `Governor.mdc` — agent behaviour constraints

Skills add procedural *how-to* knowledge. Rules are *always-on constraints*. Don't put rules in skills or vice-versa.

---

## Known Tech Debt (Don't Make Worse)

1. **50+ `console.*` calls** in `pushNotifications.ts`, `sw.ts` — use `logger.*` instead
2. **20+ `test.skip()`** with known issues — don't add more skips without a TODO comment
3. **Manual `as` casts** in form submission hooks between state and DB types — should be typed properly
4. **Inconsistent offline branching** across existing forms — new forms must follow the template
5. **No Prettier config** — match the whitespace style of the file you're editing

---

## Files You Should Know Before Touching Anything

| File | Why |
|---|---|
| `src/App.tsx` | All routes — add new lazy routes here |
| `src/lib/queryKeys.ts` | All cache keys — register new entities here |
| `src/lib/errorHandling.ts` | Error normalization — don't add duplicate logic |
| `src/contexts/OfflineQueueContext.tsx` | Offline queue registration |
| `src/lib/telemetry.ts` | Compliance tracking — don't skip |
| `supabase/migrations/` (latest file) | Schema baseline — read before adding migrations |
