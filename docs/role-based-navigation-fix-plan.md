# Role-Based Navigation Fix – Plan (with Copilot refinements)

## Problem

When a **foreman** (or other role user) clicks the JSA button in the compliance section and then clicks **back** (or post-submit "Continue"), they are sent to the **general dashboard** (`/dashboard`) instead of their **role dashboard** (e.g. `/foreman-dashboard`).

**Root cause:** Hardcoded `navigate("/dashboard")` in form back/continue handlers and access-denied screens. No single source of truth for role → dashboard mapping.

---

## Solution (agreed)

1. **Centralize** role → dashboard in `src/lib/navigation.ts` (`getRoleDashboard(role)`).
2. **Refactor** `ProtectedRoute` and `Home` to import and use it.
3. **Replace** all `navigate("/dashboard")` (and equivalent) with `navigate(getRoleDashboard(role))` in forms, celebrations, and access-denied buttons.

---

## Implementation (with Copilot refinements)

### Phase 1: Create shared utility

**File: `src/lib/navigation.ts` (new)**

- Export `getRoleDashboard(role: string | null | undefined): string` with:
  - Explicit handling for `null`/`undefined` → return `'/dashboard'`.
  - JSDoc: describe param, return, and example usage.
- **Optional (nice-to-have):** `getRoleDashboardLabel(role)` for breadcrumbs; `isAdminRole`/`isManagementRole` – can be added in a follow-up. Not required for this fix.
- **Do not** import from `../types/auth` – there is no `src/types/auth.ts` in this repo.

```ts
/**
 * Get the appropriate dashboard route for a user's role.
 * @param role - User's role from AuthContext (can be null/undefined)
 * @returns Dashboard path for the role
 */
export function getRoleDashboard(role: string | null | undefined): string {
  if (!role) return '/dashboard';
  switch (role) {
    case 'admin': return '/admin';
    case 'mechanic': return '/mechanic-dashboard';
    case 'general_foreman': return '/general-foreman-dashboard';
    case 'safety_officer': return '/safety-officer-dashboard';
    case 'foreman': return '/foreman-dashboard';
    default: return '/dashboard';
  }
}
```

---

### Phase 2: Refactor existing duplicates

- **`src/components/ProtectedRoute.tsx`**  
  Import `getRoleDashboard` from `../lib/navigation` and **remove** the local `getRoleDashboard` (lines 10–26).

- **`src/pages/Home.tsx`**  
  Import `getRoleDashboard` from `../lib/navigation` and **remove** the local `getRoleDashboard` (lines 14–29).

---

### Phase 3: Forms and celebrations

| File | Change |
|------|--------|
| **DailyJSAForm.tsx** | Add `import { getRoleDashboard } from '../../lib/navigation'`. `role` already from `useAuth()`. In **handleBack** and **handleCelebrationContinue**, use `navigate(getRoleDashboard(role))` and add `role` to dependency arrays. |
| **RequestTimeOff.tsx** | Add import for `getRoleDashboard`. Destructure **role** from `useAuth()` (currently only `user`, `fullName`). In **handleCelebrationContinue**, use `navigate(getRoleDashboard(role))` and add `role` to deps. |
| **FullComplianceCelebration.tsx** | Add `import { useAuth } from '../../contexts/AuthContext'` and `import { getRoleDashboard } from '../../lib/navigation'`. Call `const { role } = useAuth()`. In **handleContinue**, use `navigate(getRoleDashboard(role))` and add `role` to deps. |

---

### Phase 4: Access-denied "Return to Dashboard" buttons

All four files already use `useAuth()` and have `role`. Add `import { getRoleDashboard } from '../../lib/navigation'` and replace:

- `onClick={() => navigate("/dashboard")}`  
  with  
- `onClick={() => navigate(getRoleDashboard(role))}`  

**Files:**

- `src/pages/foreman/ForemanDashboard.tsx` (~line 289)
- `src/pages/foreman/ForemanDailyReports.tsx` (~line 1034)
- `src/pages/general-foreman/GeneralForemanDashboard.tsx` (~line 80)
- `src/pages/safety-officer/SafetyOfficerDashboard.tsx` (~line 77)  
  (Use correct import spacing: `import { getRoleDashboard } from ...`)

---

### Phase 5: Optional

- **404 "Go to Dashboard"** (`src/App.tsx` ~line 702): replace `<a href="/dashboard">` with a component that uses `useAuth()` and `<Link to={getRoleDashboard(role)}>` so authenticated users go to their role dashboard.
- **Unit tests:** add `src/lib/navigation.test.ts` for `getRoleDashboard()`.

---

## Files summary

| File | Action |
|------|--------|
| `src/lib/navigation.ts` | CREATE |
| `src/components/ProtectedRoute.tsx` | MODIFY (import, remove local) |
| `src/pages/Home.tsx` | MODIFY (import, remove local) |
| `src/pages/forms/DailyJSAForm.tsx` | MODIFY (import, handleBack, handleCelebrationContinue) |
| `src/pages/forms/RequestTimeOff.tsx` | MODIFY (import, add role, handleCelebrationContinue) |
| `src/components/compliance/FullComplianceCelebration.tsx` | MODIFY (imports, useAuth, handleContinue) |
| `src/pages/foreman/ForemanDashboard.tsx` | MODIFY (import, button) |
| `src/pages/foreman/ForemanDailyReports.tsx` | MODIFY (import, button) |
| `src/pages/general-foreman/GeneralForemanDashboard.tsx` | MODIFY (import, button) |
| `src/pages/safety-officer/SafetyOfficerDashboard.tsx` | MODIFY (import, button) |
| `src/App.tsx` | OPTIONAL (404 link) |

---

## Testing (from Copilot)

1. **Foreman JSA back (primary bug):** Foreman → Foreman Dashboard → Compliance → JSA → Back → must land on `/foreman-dashboard`, not `/dashboard`.
2. **Foreman JSA completion:** Submit JSA → celebration Continue → `/foreman-dashboard`.
3. **Other roles:** Mechanic, General Foreman, Safety Officer, Admin, Employee – back/continue and access-denied "Return to Dashboard" go to correct dashboard.
4. **Full compliance celebration:** Complete all three forms → Continue → role dashboard.
5. **Access-denied:** e.g. employee visits `/foreman-dashboard` → Access Denied → Return to Dashboard → `/dashboard`.

---

## ReturnButton

No change. It already routes by role when visible; the bug was only in the JSA form’s (and other) hardcoded back/continue targets.
