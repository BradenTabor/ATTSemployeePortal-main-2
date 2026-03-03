---
name: ui-design-guide
description: ATTS Employee Portal visual design system — role-based color theming (7 roles), premium solid surface system (no glassmorphism — layered shadows + top-highlight depth), typography scale, icon sizing, border radius, shadow system, button sizing (sm/md/lg), all component visual states, animation system with performance budget, offline/online UI states, mobile-first breakpoints for field workers, PWA safe areas, z-index layering, nav/drawer/modal/table/select/confirmation/alert patterns, WCAG accessibility standards, print styles, empty/error/loading state patterns. UX Specialist v5.1 integration: Brand DNA pre-extracted, design direction locked, surface system defined, layer stack mapped to Z.* constants, Beautify mode constraints enforced. Load before creating or modifying any UI component or page.
triggers:
  - "create a page"
  - "build a component"
  - "update the UI"
  - "style"
  - "design"
  - "layout"
  - "add animation"
  - "loading state"
  - "empty state"
  - "error state"
  - "add a button"
  - "create a table"
  - "create a modal"
  - "create a drawer"
  - "navigation"
  - "form design"
  - any .tsx file creation
  - "beautify"
  - "BEAUTIFY:"
  - "audit"
version: 2.2
reviewed: 2026-02-19
---

# ATTS Employee Portal — UI Design Guide v2.1

## The App's Visual Identity in One Sentence
ATTS is a dark-themed, premium solid-surface safety PWA for field workers on mobile and admins on desktop. Everything must feel **solid, trustworthy, and scannable at a glance** — not decorative. Field workers wear gloves. Admins review data. Both must trust the interface completely.

---

## ★ UX SPECIALIST v5.1 — PROJECT INTEGRATION

> **If you are the UX Specialist v5.1 agent, read this section completely before executing any Beautify or Audit step. It overrides your defaults for this project.**

---

### Brand DNA (pre-extracted — do NOT re-scan)

This file IS the Brand DNA source for ATTS. Do not scan source files to extract it. Use these values directly:

```
BRAND DNA — ATTS Employee Portal:
  Background base:      #030712 (bg-gray-950) — the deepest layer
  Surface primary:      #111827 (bg-gray-900) — card / panel
  Surface secondary:    #1F2937 (bg-gray-800) — inputs, table rows
  Primary accent:       role-dependent (see Section 1 — 7 roles, 7 colors)
  Dominant accent:      amber-400 (#F59E0B) — admin role, most common admin surface
  Surface system:       solid premium surfaces — layered shadows + top-highlight depth (import from @/lib/glass)
  Border language:      border-white/[0.06] standard | border-white/[0.08] elevated | border-white/[0.04] subtle
  Text hierarchy:       white → white/80 → white/60 → white/40 (see Section 2)
  Existing motion:      Framer Motion — variants in @/lib/animations (see Section 12)
  Animation budget:     STRICT — mid-range Android target. 200ms max. See Section 12.
  Image gen API:        none (do not generate images — PWA, no external asset pipeline)
  Typography:           System font stack only — NO custom font imports (PWA load time critical)
  Border radius:        rounded-2xl cards | rounded-xl buttons/inputs | rounded-full badges
  App type:             Safety-critical PWA — field workers on mobile, admins on desktop
  Personality:          Trustworthy, authoritative, dark, premium, role-aware
```

---

### Design Direction — LOCKED: Dark Technical (Safety Variant)

The design direction for ATTS is **Dark Technical**, with safety-critical modifications:

- Deep dark backgrounds with solid premium surfaces ✓
- Role-based accent luminescence (7 colors) instead of single primary ✓
- Precise, glove-friendly touch targets ✓
- Motion is restrained and purposeful — NOT kinetic ← **safety-critical modification**
- Atmospheric depth via layered shadows and subtle borders — NOT blur, NOT particle fields ← **aesthetic + performance**

**Do not ask the user to confirm direction. It is locked. Proceed immediately.**

---

### Layer Stack Map — ATTS (using Z.* constants)

Map v5.1's 6-layer model to this project's `Z.*` system (`@/lib/zIndex`):

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5 — FLOATING UI          Z.tooltip (700)             │
│  Tooltips, toasts (Sonner)                                  │
│  Z.toast (600), Z.tooltip (700)                             │
├─────────────────────────────────────────────────────────────┤
│  LAYER 5 — FLOATING UI (cont.)  Z.modal (500)               │
│  Modals, drawers, confirmation dialogs                      │
│  Use: style={{ zIndex: Z.modal }}                           │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4 — SURFACE OVERLAY      Z.nav (400)                 │
│  Bottom nav bar, sidebar nav                                │
│  Also: offline banner Z.offlineBanner (300)                 │
│  Also: sticky headers Z.sticky (200)                        │
│  Also: dropdowns Z.dropdown (100)                           │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3 — CONTENT              Z.card (10) / Z.base (0)    │
│  All page content, cards, forms, tables                     │
│  Standard document flow                                     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2 — STRUCTURAL SURFACES  Z.base (0)                  │
│  Solid premium cards, panels — import from @/lib/glass      │
│  NEVER inline: bg-white/[N] backdrop-blur-[X]               │
│  Depth via shadows + top-highlight, NOT blur                 │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1 — ATMOSPHERIC          style={{ zIndex: -1 }}      │
│  ⚠️  CONSTRAINED — see Layer 1 rules below                   │
│  Static radial gradients ONLY. No animated blobs.           │
│  No particle fields. No scan-line grids.                    │
├─────────────────────────────────────────────────────────────┤
│  LAYER 0 — PAGE BACKGROUND      bg-gray-950 (#030712)       │
│  Applied by DashboardLayout — DO NOT modify                 │
└─────────────────────────────────────────────────────────────┘
```

**Z-index rule**: Always use `style={{ zIndex: Z.* }}` — never hardcode numeric z-index in className. `Z.*` constants live in `@/lib/zIndex.ts`.

---

### Layer 1 — Atmospheric Constraints (PERFORMANCE CRITICAL)

ATTS targets **mid-range Android devices** used by field workers. This creates hard constraints on Layer 1:

**✅ Allowed in Layer 1:**
```tsx
// Static radial glow — role accent color, no animation
<div
  className="absolute inset-0 pointer-events-none select-none"
  style={{ zIndex: -1 }}
  aria-hidden="true"
>
  <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.06]"
    style={{
      background: 'radial-gradient(circle, #F59E0B, transparent 70%)',
      filter: 'blur(60px)',
      transform: 'translate(30%, -30%)',
    }} />
</div>

// Subtle CSS gradient behind hero — no animation, no keyframes
<div
  className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"
  style={{ zIndex: -1 }}
  aria-hidden="true"
/>
```

**❌ Forbidden in Layer 1 (performance):**
- Morphing blobs with `border-radius` keyframe animations (12s CSS animation = GPU churn)
- `ParticleField` components (40+ DOM nodes, continuous `translate` animation)
- Scan-line grid animations (`animation: scan-sweep infinite`)
- Any `animation-duration > 0` on Layer 1 — static only
- Any Layer 1 element that uses `will-change` or forces a new compositor layer

**Why:** Field workers open inspection forms mid-job on 3-year-old Android phones. A particle field that's beautiful on desktop will drop frames and delay form input on the target device. Trustworthy > decorative.

---

### Surface System — Use @/lib/glass Only

**v5.1 default behavior to override:** The agent normally generates glassmorphism patterns (`bg-white/[0.05] backdrop-blur-xl border border-white/10`). ATTS no longer uses glassmorphism. The surface system uses solid dark backgrounds with layered shadows and a subtle top-edge highlight for depth.

**Rule:** Never write backdrop-blur or bg-white/[N] on major surfaces. Never write inline surface styles. Always import and apply `glass.*`:

```tsx
import { glass } from '@/lib/glass'

// ✅ Correct
<div className={glass.card}>...</div>
<div className={glass.elevated}>...</div>
<div className={glass.subtle}>...</div>
<div className={glass.danger}>...</div>
<div className={glass.success}>...</div>

// ❌ Wrong — glassmorphism, not used in ATTS
<div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl">...</div>

// ❌ Also wrong — inline surface values
<div className="bg-gray-900 border border-white/[0.06] rounded-2xl shadow-lg">...</div>
```

The surface constants (kept as `glass.*` for backward compatibility):
```tsx
card:     'bg-gray-900 border border-white/[0.06] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]'
elevated: 'bg-gray-800 border border-white/[0.08] rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.6),0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]'
subtle:   'bg-[#0d1117] border border-white/[0.04] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
danger:   'bg-red-950 border border-red-500/[0.18] rounded-2xl shadow-[0_4px_16px_rgba(127,29,29,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]'
success:  'bg-green-950 border border-green-500/[0.18] rounded-2xl shadow-[0_4px_16px_rgba(20,83,45,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]'
```

**What the `inset_0_1px_0` shadow does:** Creates a 1px lighter top edge — the "lit from above" effect that gives surfaces physical material quality. This is the signature of premium dark UIs (Vercel, Linear, Stripe). Subtle at 4% opacity on cards, 6% on elevated modals.

If a new surface variant is genuinely needed, add it to `@/lib/glass.ts` — do not use it inline.

---

### Animation System — Use @/lib/animations Only

**v5.1 default behavior to override:** The agent normally defines new animation variants inline or in component files. In this project, all shared variants live in `@/lib/animations.ts`.

**Rule:** Never define new Framer Motion variants outside `@/lib/animations.ts`. Use existing variants:

```tsx
import { fadeIn, slideInUp, slideInLeft, slideInRight, scaleIn, staggerContainer } from '@/lib/animations'
import { useReducedMotion } from 'framer-motion'

const shouldReduce = useReducedMotion()

// ✅ Correct
<motion.div variants={shouldReduce ? {} : slideInUp} initial="hidden" animate="visible">

// ❌ Wrong — never define inline
<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
```

**Animation duration ceiling: 200ms.** No transition or animation may exceed this. The v5.1 default of 600ms scroll reveals is too slow for this app's target devices and use-context (safety forms, not landing pages).

**Scroll reveal animations:** Do not add `useScrollReveal` hook or CSS `.reveal` classes to this project. Page content is primarily forms and data tables, not marketing sections. Use `staggerContainer` + `slideInUp` on dashboard card grids only.

**`useReducedMotion` is mandatory** on every Framer Motion element — already established in the codebase. Never omit it.

---

### SVG Icon Generation — Sizing Rules

When v5.1 generates custom SVG icons for decorative/feature use, apply this project's sizing system (Section 7):

```
Context                     | v5.1 viewBox  | strokeWidth | Tailwind size class
Empty state illustration    | 0 0 32 32     | 1.5         | w-8 h-8 opacity-50
Section / card header icon   | 0 0 24 24     | 1.5         | w-6 h-6
Standard card feature icon  | 0 0 20 20     | 2           | w-5 h-5
Inline with body text       | 0 0 16 16     | 2           | w-4 h-4
```

Generated icons must use `currentColor` for stroke/fill so they inherit role accent colors. Generated icons go in `src/components/icons/` following existing file conventions.

**Role-aware icons:** Feature icons on role-gated sections should receive the role's accent color via the parent's text color:
```tsx
// Parent sets the color context
<div className="text-amber-400">  {/* admin role */}
  <CustomIcon className="w-5 h-5" />  {/* inherits currentColor = amber-400 */}
</div>
```

---

### Beautify Mode — Locked vs Unlocked

When running `BEAUTIFY:` on any ATTS page, this matrix is absolute:

#### 🔒 LOCKED — Do Not Modify

| Element | Reason |
|---------|--------|
| `DashboardLayout` classes | Provides page padding, scroll container, background — modifying breaks layout system-wide |
| `bg-gray-950` page background | Layer 0 is fixed — part of PWA identity |
| System font stack | No custom font imports — PWA load time critical |
| `@/lib/glass` constant values | Surface system change is system-wide — update values in the file, never inline |
| `@/lib/animations` variant values | Duration/easing locked — Android performance budget |
| `@/lib/typography` constant values | Type scale locked — changes affect all components |
| `@/lib/zIndex` values | Z-index system locked — modifying causes stacking bugs |
| Role accent colors (Section 1) | Role colors are UX identity — not aesthetic preference |
| Semantic colors (Section 2) | Error/warning/success/offline colors are meaning-critical |
| Bottom nav height (h-14, min-h-[56px]) | Touch targets locked for field worker glove use |
| `focus-visible:ring-*` patterns | Accessibility locked — WCAG compliance |

#### 🔓 UNLOCKED — Agent May Modify

| Element | Guidance |
|---------|----------|
| Layer 1 atmospheric depth | Static radial glows only — see Layer 1 constraints above |
| Layer 4 noise overlay | Allowed — low opacity (0.02–0.03), `pointer-events-none`, `position: fixed`, `z-index: Z.card` |
| Surface consistency | Ensure `glass.card` is applied consistently — replace any remaining backdrop-blur or inline bg-white/[N] patterns with `glass.*` constants |
| Shadow usage | Add `shadows.card` or `shadows.elevated` where missing — import from `@/lib/shadows` |
| Custom SVG decorative icons | Use sizing rules above. Replace generic lucide icons on feature/empty state cards. |
| Empty state polish | Upgrade empty states to include icon container + improved copy — keep `glass.subtle` surface |
| Scroll animation on dashboard card grids | `staggerContainer` + `slideInUp` from `@/lib/animations` — stagger limit: 8 items |
| Card hover states | `hover:border-white/20` or role-color `hover:border-[role-color]/40` + `transition-colors duration-150` |
| Typography application | Ensure `typography.*` constants are used — replace ad-hoc type classes |
| Section label formatting | `typography.labelSm` for all section headers (uppercase, tracked) |
| Focus ring consistency | Standardize `focus-visible:ring-2` patterns where missing |
| `aria-hidden` on decorative elements | Add where missing |
| `useReducedMotion` coverage | Add where missing from existing Framer Motion usage |

---

### Beautify Output Format Reminder

This project has a strict design system. The self-narrated `✅ [PHASE N]` execution format still applies, but the `→ Code:` field must reference the correct library imports:

```
✅ [PHASE 2 — LAYER 2] Unified surface system across HistoryCard components
   → Effect: All history cards now use glass.card — consistent solid dark surface, fine border,
     and layered shadows with top-highlight. No more backdrop-blur or bg-white/[N] patterns.
   → Why: 3 cards had inline backdrop-blur-xl bg-white/5 — glassmorphism values that conflict
     with the premium solid surface direction. Also not pulling from the shared constant.
   → Code: HistoryCard.tsx, DVIRCard.tsx, JSACard.tsx — removed backdrop-blur, replaced
     inline values with import { glass } from '@/lib/glass' and className={glass.card}
   → Next: Checking shadow consistency — cards should use shadows.card from @/lib/shadows
```

---

## 1. Role-Based Color Theming

Each role has a distinct accent color used for: active nav indicators, role badges, card border highlights on role-gated content, primary button variants in role-scoped sections, and the progress indicator fill on wizard forms.

| Role | Accent | Primary Class | Muted Class | Hex | Context |
|---|---|---|---|---|---|
| `admin` | Amber / Gold | `text-amber-400` / `bg-amber-500` | `bg-amber-500/20 border-amber-500/30` | `#F59E0B` | System admin, user management, settings |
| `safety_officer` | Red + White | `text-red-400` / `bg-red-600` | `bg-red-600/20 border-red-500/30` | `#DC2626` | Safety reviews, incident approvals, OSHA reports |
| `foreman` | Blue | `text-blue-400` / `bg-blue-600` | `bg-blue-600/20 border-blue-500/30` | `#2563EB` | Team oversight, daily sign-offs, scheduling |
| `employee` | Green | `text-green-400` / `bg-green-600` | `bg-green-600/20 border-green-500/30` | `#16A34A` | General workers, form submission, daily tasks |
| `mechanic` | Orange | `text-orange-400` / `bg-orange-500` | `bg-orange-500/20 border-orange-500/30` | `#F97316` | DVIR, equipment inspection, maintenance |
| `general_foreman` | Purple | `text-purple-300` / `bg-purple-600` | `bg-purple-600/20 border-purple-500/30` | `#9333EA` | Crew oversight, multi-crew sign-offs |
| `manager` | Teal | `text-teal-400` / `bg-teal-600` | `bg-teal-600/20 border-teal-500/30` | `#0D9488` | Operations management, reporting |

**How to apply role theming:**
- A user sees their own role's accent on: active nav state, primary CTA buttons, profile badge, wizard step indicators
- Role badges on user cards and admin tables always use the muted class (semi-transparent bg + border)
- Do NOT theme entire pages per role — only accent interactive elements
- On role-gated admin pages, always use `admin` amber for primary actions regardless of who's viewing

**⚠️ Safety Officer Red vs. Error Red — Resolving the Conflict:**
`safety_officer` uses `red-400`/`red-600`. The Error semantic color also uses red. Never place safety officer role elements adjacent to error states without a shape or label to differentiate them. A role badge always has a text label. An error always has an `AlertCircle` icon. Color alone is never sufficient — shape + color together are required.

**Role badge pattern:**
```tsx
// src/components/ui/RoleBadge.tsx
export const ROLE_BADGE_STYLES = {
  admin:            'bg-amber-500/20  text-amber-400  border border-amber-500/30',
  safety_officer:   'bg-red-600/20    text-red-400    border border-red-500/30',
  foreman:          'bg-blue-600/20   text-blue-400   border border-blue-500/30',
  employee:         'bg-green-600/20  text-green-400  border border-green-500/30',
  mechanic:         'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  general_foreman:  'bg-purple-600/20 text-purple-300 border border-purple-500/30',
  manager:          'bg-teal-600/20   text-teal-400   border border-teal-500/30',
} as const;

// Usage:
<span className={`${ROLE_BADGE_STYLES[role]} text-xs font-medium px-2 py-0.5 rounded-full`}>
  {role.replace('_', ' ')}
</span>
```

---

## 2. Color Palette — Core

The app is **dark-only** — no light mode, no system preference toggle. All colors are calibrated for dark backgrounds. Never use pure white (`#FFFFFF`) or pure black (`#000000`).

### Backgrounds (darkest → lightest)
```
bg-gray-950   (#030712)  ← page body, the deepest layer
bg-gray-900   (#111827)  ← primary card / panel surface
bg-gray-800   (#1F2937)  ← inputs, secondary surfaces, table rows
bg-gray-700   (#374151)  ← hover states, selected rows, elevated panels
```

### Surface Hover & Interaction Tints
These values are used for **hover states and interaction feedback only** — not for card/panel backgrounds (those use solid gray values via `glass.*`).
```
bg-white/5    ← skeleton loaders, photo upload zone base
bg-white/10   ← hover state on interactive surfaces
bg-white/15   ← active/pressed state
bg-white/20   ← strong hover (ghost button hover)
```

### Text Hierarchy
```
text-white        ← page titles, card headings, labels
text-white/80     ← body text, descriptions — primary readable content
text-white/60     ← secondary text, captions, metadata
text-white/40     ← placeholder text, disabled labels, timestamps
text-white/20     ← borders, dividers, decorative separators
text-white/10     ← very subtle hover micro-tints
```

### Semantic Colors (status only — do NOT use for role theming even if colors overlap)
```
Success:  text-green-400  / bg-green-500/20  / border-green-500/30   ← completed, approved, synced
Warning:  text-yellow-400 / bg-yellow-500/20 / border-yellow-500/30  ← pending, expiring, review needed
Error:    text-red-400    / bg-red-500/20    / border-red-500/30      ← failed, rejected, invalid
Info:     text-sky-400    / bg-sky-500/20    / border-sky-500/30      ← informational tips
Offline:  text-gray-400   / bg-gray-500/20   / border-gray-500/30     ← offline / queued (NOT red)
```

**Note on red overlap:** Error uses `red-500/20` bg (lighter). Safety officer role uses `red-600/20` bg (darker). Distinguishable at a glance when properly labeled — but never place them adjacent without labels.

---

## 3. Surface System

Depth and hierarchy are created through **layered shadows and precise borders**, not blur and transparency. Every surface feels physically present and trustworthy.

### Surface Depth Hierarchy

| Surface | Color | Use |
|---|---|---|
| Page base | `bg-gray-950` (#030712) | Deepest layer — DashboardLayout |
| Standard card | `bg-gray-900` (#111827) | Dashboard widgets, form panels, stat cards |
| Elevated surface | `bg-gray-800` (#1F2937) | Modals, drawers, floating panels |
| Inner surface | `#0d1117` | Nested panels, inner card sections |
| Input / table row | `bg-gray-800` | Form fields, table rows — same as elevated |

### What Creates Depth (not blur)

**Layered box-shadows:** Two shadow layers (sharp edge + ambient spread) make surfaces feel lifted off the page.

**Top-edge highlight:** `inset 0 1px 0 rgba(255,255,255,0.04)` — a single pixel of lighter color at the top edge suggests the surface is lit from above. This is the signature of premium dark UIs.

**Fine hairline borders:** 1px borders at 6-8% white opacity define the card edge cleanly without competing with content.

### Surface Class Definitions (never freestyle — always import from `@/lib/glass`)

The file is named `glass.ts` for backward compatibility. The values are now solid premium surfaces.

```tsx
// src/lib/glass.ts
export const glass = {
  // Standard card — dashboards, stat cards, form panels
  card:
    'bg-gray-900 border border-white/[0.06] rounded-2xl ' +
    'shadow-[0_1px_3px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]',

  // Elevated — modals, drawers, floating panels
  elevated:
    'bg-gray-800 border border-white/[0.08] rounded-2xl ' +
    'shadow-[0_2px_8px_rgba(0,0,0,0.6),0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]',

  // Subtle — nested inner panels, role callouts
  subtle:
    'bg-[#0d1117] border border-white/[0.04] rounded-xl ' +
    'shadow-[0_1px_2px_rgba(0,0,0,0.3)]',

  // Danger — confirmation dialogs, emergency surfaces
  danger:
    'bg-red-950 border border-red-500/[0.18] rounded-2xl ' +
    'shadow-[0_4px_16px_rgba(127,29,29,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]',

  // Success — completed/approved surfaces
  success:
    'bg-green-950 border border-green-500/[0.18] rounded-2xl ' +
    'shadow-[0_4px_16px_rgba(20,83,45,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]',
} as const;
```

### When to Use Each Surface Level

| Element | Surface |
|---|---|
| Dashboard widgets / stat cards | `glass.card` |
| Form container panels (wizard step wrappers) | `glass.card` |
| Role-specific callout panels | `glass.subtle` |
| Modals and dialogs | `glass.elevated` |
| Drawers / side panels | `glass.elevated` |
| Confirmation dialogs | `glass.danger` |
| Success confirmation panels | `glass.success` |
| Notification / alert banners | `glass.card` |

### What Never Gets a Surface Treatment
- Input fields → `bg-gray-800 border border-white/10` (Section 11)
- Table rows → `bg-gray-900` default, `bg-gray-800` hover
- Buttons → solid role colors (Section 10)
- Tooltips → `bg-gray-800 border border-white/[0.06]`
- Skeleton loaders → `bg-white/5 animate-pulse` (no border, no shadow)
- Nav bars → solid `bg-gray-900` + bottom/side border only (no card shadow)

---

## 4. Border Radius System

Consistent radii establish a coherent visual language. Never use ad-hoc classes on major surfaces.

| Context | Class | Value |
|---|---|---|
| Page-level cards, modal containers, wizard panels | `rounded-2xl` | 16px |
| Buttons, input fields, secondary cards, drawers | `rounded-xl` | 12px |
| Table rows, tooltip containers, inline code blocks | `rounded-lg` | 8px |
| Badges, chips, tags, pills | `rounded-full` | 9999px |
| Skeleton shapes | Match the element they replace | — |

**Rule:** When uncertain, round one size up. Rounder reads as safer — appropriate for a safety app.

---

## 5. Shadow System

Shadows reinforce the depth hierarchy. Use sparingly — every shadow should serve a purpose.

```tsx
// src/lib/shadows.ts
export const shadows = {
  none:     '',
  sm:       'shadow-sm shadow-black/20',               // subtle depth, raised buttons
  card:     'shadow-lg shadow-black/20',               // standard elevated card
  elevated: 'shadow-2xl shadow-black/40',              // modals, drawers
  glow: {
    admin:            'shadow-lg shadow-amber-500/25',
    safety_officer:   'shadow-lg shadow-red-600/25',
    foreman:          'shadow-lg shadow-blue-600/25',
    employee:         'shadow-lg shadow-green-600/25',
    mechanic:         'shadow-lg shadow-orange-500/25',
    general_foreman:  'shadow-lg shadow-purple-600/25',
    manager:          'shadow-lg shadow-teal-600/25',
  },
} as const;
// Role glow shadows: apply to primary buttons on hover/focus state only
```

---

## 6. Typography Scale

Single font: system font stack (no custom font import — PWA load time critical). Always import `typography` constants; never hardcode type classes.

```tsx
// src/lib/typography.ts
export const typography = {
  // Display
  pageTitle:    'text-2xl   font-bold     text-white     leading-tight',
  sectionTitle: 'text-xl    font-semibold text-white     leading-snug',
  cardTitle:    'text-lg    font-semibold text-white     leading-snug',
  // Body
  bodyLg:       'text-base  font-normal   text-white/80  leading-relaxed',
  body:         'text-sm    font-normal   text-white/80  leading-relaxed',
  bodySm:       'text-xs    font-normal   text-white/60  leading-relaxed',
  // UI Labels
  label:        'text-sm    font-medium   text-white/80',
  labelSm:      'text-xs    font-medium   text-white/60  uppercase tracking-wider',
  // Utility
  caption:      'text-xs    font-normal   text-white/40',
  mono:         'text-sm    font-mono     text-white/70',
  code:         'text-xs    font-mono     text-white/70  bg-white/10 px-1.5 py-0.5 rounded',
  link:         'text-sm    font-medium   text-blue-400  hover:text-blue-300 underline-offset-2 hover:underline transition-colors',
} as const;
```

**Rules:**
- `leading-relaxed` on all body text — never `leading-tight` for multi-line content
- `truncate` on table cells, card subtitles, badge text — never allow overflow to reflow layout
- `text-base` (16px) minimum on all form `<input>` elements — prevents iOS auto-zoom (never `text-sm` on inputs)
- Numeric / date data in tables: `font-mono` for column alignment

---

## 7. Icon Sizing System

Never use ad-hoc icon sizes. Import from Lucide and apply consistent sizes:

| Context | Size | px | Notes |
|---|---|---|---|
| Empty state illustration | `w-8 h-8` | 32 | With `opacity-50` |
| Section / card header | `w-6 h-6` | 24 | Alongside section title |
| Standard button / nav | `w-5 h-5` | 20 | Most common size |
| Inline with body text | `w-4 h-4` | 16 | Table cells, labels |
| Validation / micro | `w-3 h-3` | 12 | Error messages, captions |
| FAB | `w-6 h-6` | 24 | Bottom-right floating button |
| Bottom nav tabs | `w-6 h-6` | 24 | Mobile tab bar |

**Stroke width:** Default `strokeWidth={2}` for ≤20px icons. Use `strokeWidth={1.5}` for ≥24px to avoid heavy appearance at larger sizes.

**Common icons by context:**
```tsx
// Navigation
LayoutDashboard, FileText, Users, Settings, AlertTriangle, Truck, TreePine, Shield

// Actions
Plus, Edit2, Trash2, Download, Upload, RefreshCw, Search, Filter, X, MoreHorizontal

// Status & feedback
CheckCircle2, XCircle, AlertCircle, Clock, Loader2, Info, AlertTriangle

// Offline / sync
WifiOff, Wifi, CloudOff, UploadCloud, RefreshCw

// Forms
Clipboard, Camera, MapPin, Calendar, User, Phone, ChevronDown, Check
```

---

## 8. Spacing & Layout System

**Page padding — provided by DashboardLayout, do NOT re-add:**
- Mobile: `px-4 py-4`
- Desktop: `px-6 py-6`

**Card internal padding:**
- Default: `p-6`
- Compact (stat cards, small panels): `p-4`
- Table cells: `px-4 py-3`
- Tight (badges, chips): `px-2 py-1` or `px-3 py-1.5`

**Vertical rhythm:**
```
gap-1 / mb-1  — icon + label inline pairs
gap-2 / mb-2  — label above its input field
gap-4 / mb-4  — between form fields in a section
gap-6 / mb-6  — between form sections or card sections
gap-8 / mb-8  — between major page sections
```

**Grid patterns:**
```tsx
"grid grid-cols-2 md:grid-cols-4 gap-4"      // Stat cards row
"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"   // Dashboard widgets
"grid grid-cols-1 md:grid-cols-2 gap-4"      // Two-column form (desktop only)
"flex flex-wrap items-center gap-3"           // Admin filter bar
"flex items-center gap-2"                     // Action button group
```

---

## 9. Component Visual States

Every interactive element handles all five states. No exceptions.

| State | Treatment |
|---|---|
| Default | Base styles |
| Hover | `bg-white/10` tint or role-color shift — `transition-colors duration-150` always |
| Focus (keyboard) | `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900` + role-colored ring |
| Active / Pressed | `active:scale-[0.98]` — CSS only, no Framer Motion needed |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none` |

**Critical: Always use `focus-visible:` not `focus:`**
`focus-visible:` only shows the ring for keyboard navigation. `focus:` shows it on every tap, which is distracting on mobile.
```tsx
// ✅ Correct — ring only on keyboard navigation
'focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 focus:outline-none'

// ❌ Wrong — ring appears on every mobile tap
'focus:ring-2 focus:ring-blue-500/50'
```

---

## 10. Button Sizing System

Three sizes. Always use the shared `Button` component — never custom-build button styles inline in a page.

| Size | Padding + Font | Min Height | Use Case |
|---|---|---|---|
| `sm` | `px-3 py-1.5 text-xs rounded-lg` | 32px | Table row actions, badge-level buttons |
| `md` *(default)* | `px-4 py-2.5 text-sm rounded-xl` | 40px | Standard page and filter bar actions |
| `lg` | `px-6 py-3 text-base rounded-xl` | 48px | Primary form submit, main page CTA |

**Variant classes:**
```tsx
// Primary (role-colored — the single most important action per view)
'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold transition-colors duration-150'

// Secondary (alongside a primary action)
'bg-white/10 hover:bg-white/15 active:bg-white/20 text-white font-medium border border-white/10 transition-colors duration-150'

// Ghost (tertiary or nav-adjacent)
'hover:bg-white/10 active:bg-white/15 text-white/70 hover:text-white font-medium transition-all duration-150'

// Danger (destructive: delete, reject, revoke)
'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold transition-colors duration-150'

// All variants append: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
```

**Loading state:**
```tsx
<Button disabled={isSubmitting}>
  {isSubmitting
    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
    : 'Submit'
  }
</Button>
```

---

## 11. Input & Form Field System

**Standard input:**
```tsx
'w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-base text-white
 placeholder:text-white/30
 focus:outline-none focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20
 transition-all duration-150'
```

**State modifiers (add to base):**
```tsx
// Error
'border-red-500/50 focus-visible:border-red-500/70 focus-visible:ring-red-500/20'

// Success (field-level confirmation)
'border-green-500/50 focus-visible:border-green-500/70 focus-visible:ring-green-500/20'

// Disabled
'opacity-50 cursor-not-allowed bg-gray-900 select-none'
```

**Select / Dropdown:**
```tsx
// Wrap native <select> — never style it alone (OS rendering differs)
<div className="relative">
  <select className="
    w-full appearance-none bg-gray-800 border border-white/10 rounded-xl
    px-4 py-3 text-base text-white cursor-pointer
    focus:outline-none focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20
    transition-all duration-150
  ">
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
</div>
```

**Textarea:** Same as standard input + `resize-none min-h-[120px]`. Never allow resize — it breaks layout.

**Custom Checkbox / Radio:**
```tsx
<div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150
  ${checked ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-white/30 hover:border-white/60'}`}>
  {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
</div>
```

---

## 12. Animation System

**Strict performance budget** — ATTS targets mid-range Android devices. Animations must never block input or cause layout shift.

### What Gets Animated

| Element | Type | Duration | Notes |
|---|---|---|---|
| Page entry | fade + slide Y +8px | 200ms | Via DashboardLayout |
| Wizard step (forward) | slide X –20px + fade | 200ms | Direction-aware |
| Wizard step (backward) | slide X +20px + fade | 200ms | Direction-aware |
| Modal open | scale 0.95→1 + fade | 150ms | |
| Modal close | scale 1→0.95 + fade | 120ms | Slightly faster |
| Drawer open | slide X (–100%) → 0 | 200ms | |
| Drawer close | slide X 0 → (–100%) | 160ms | Faster close |
| Dashboard cards | stagger slide Y + fade | 300ms total | 50ms stagger between items |
| Skeleton → content | fade in | 200ms | |
| Toast | slide Y –8px + fade | 150ms | Handled by Sonner |
| Button press | scale 0.98 | 100ms | CSS `active:` only — no Framer |
| Dropdown open | scale Y 0.95→1 + fade | 100ms | `origin-top` |

### Shared Variants (always import from `@/lib/animations` — never define inline)
```tsx
// src/lib/animations.ts
import type { Variants } from 'framer-motion';

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};
export const slideInUp: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, y: 4,  transition: { duration: 0.15 } },
};
export const slideInLeft: Variants = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, x: -10, transition: { duration: 0.15 } },
};
export const slideInRight: Variants = {
  hidden:  { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, x: 10, transition: { duration: 0.15 } },
};
export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.12 } },
};
export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05 } },
};
```

### Reduced Motion — Always Required
```tsx
import { useReducedMotion } from 'framer-motion';
const shouldReduce = useReducedMotion();

<motion.div variants={shouldReduce ? {} : slideInUp} initial="hidden" animate="visible">
```

### What Never Gets Animated
- Table row renders (too many DOM mutations)
- Form field focus/blur (must be instant)
- Validation error appearance (must be instant — never delayed)
- Loading spinners (CSS `animate-spin` only)
- Any list with more than 8 items (stagger limit)
- Offline banner (urgent — no delay acceptable)

---

## 13. Loading States

Match loading shape to content shape. Never use a generic centered spinner for page-level data loads.

| Context | Treatment |
|---|---|
| Full page / main section | `<SkeletonRows>` matching content shape |
| Dashboard widget | `<SkeletonCard>` matching card dimensions |
| Stat number | Inline `<div className="h-8 w-16 bg-white/10 animate-pulse rounded" />` |
| Button submitting | Spinner inside button + disabled + text change (see Section 10) |
| Image | Blur-up placeholder → `<img loading="lazy" />` |
| Table body | `<SkeletonRows count={pageSize} columns={n} />` — same row count as page size |

**Skeleton classes:**
```tsx
// Text line (vary widths for natural look)
<div className="h-4 bg-white/10 animate-pulse rounded w-3/4 mb-2" />
<div className="h-4 bg-white/10 animate-pulse rounded w-1/2" />

// Card
<div className="h-32 bg-gray-800/60 animate-pulse rounded-2xl border border-white/[0.04]" />

// Avatar
<div className="w-10 h-10 bg-white/10 animate-pulse rounded-full flex-shrink-0" />

// Table row
<div className="h-12 bg-gray-800/40 animate-pulse rounded-lg" />
```

**Shimmer direction:** Left-to-right shimmer only. Add `animate-shimmer` to `tailwind.config.js` if not present.

Never show a Suspense fallback as a blank screen. Always `<SkeletonRows>` or a shaped placeholder.

---

## 14. Empty States

Every list, table, and data surface must have a designed empty state. Never an empty `<tbody>` or blank div.

**Type 1 — Genuinely empty (nothing created yet):**
```tsx
<EmptyState
  icon={<Clipboard className="w-8 h-8 text-white/30" />}
  title="No inspections yet"
  description="Start your first daily inspection to get going."
  action={<Button size="lg">New Inspection</Button>}
/>
```

**Type 2 — Filter empty (data exists, but filters returned nothing):**
```tsx
<EmptyState
  icon={<Search className="w-8 h-8 text-white/30" />}
  title="No results found"
  description="Try adjusting your filters or search terms."
  action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
/>
```

**Rule:** Type 2 never shows a "Create" CTA — never conflate "nothing matched" with "nothing exists."

**Empty state shell:**
```tsx
<div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-sm mx-auto">
  <div className="mb-4 opacity-50">{icon}</div>
  <h3 className={typography.cardTitle}>{title}</h3>
  <p className={`${typography.bodySm} mt-2 mb-6`}>{description}</p>
  {action}
</div>
```

---

## 15. Error States

| Context | Component | Notes |
|---|---|---|
| Full page data failure | `<PageErrorState>` | Retry button + message |
| Table / list failure | `<TableErrorBanner>` | Full-width, ABOVE table, not inside |
| Form field validation | Inline `<p>` below field | `text-red-400 text-xs mt-1` + `AlertCircle` icon |
| Form submission failure | `<FormErrorBanner>` at top + `formToast.error()` | Both — banner stays, toast auto-dismisses |
| Unexpected error boundary | `<ErrorBoundary>` fallback | Never show raw JS errors in production |
| Offline / connectivity | `<OfflineBanner>` | Persistent, not dismissible |

**Validation error display:**
```tsx
{errors.fieldName && (
  <p id={`${fieldName}-error`} role="alert" className="flex items-center gap-1 text-red-400 text-xs mt-1">
    <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
    {errors.fieldName}
  </p>
)}
```

**Never swallow errors silently.** Every caught error surfaces somewhere visible and is logged with `logger.error`.

---

## 16. Offline / Online UI States

Offline is **expected behaviour**, not an error. Never use red for offline. Never make offline feel broken.

**All elements that must respond to `isOnline()` (from `@/lib/offlineQueue`):**
- `<OfflineBanner>` — persistent, full-width, below nav, never dismissible
- Submit button: `"Submit"` → `"Save for Later"` when offline
- Photo upload button: `disabled` when offline, tooltip: `"Photos upload when you reconnect"`
- Sync count badge on nav icon when queue has items
- Spinner + `"Syncing N items..."` text when reconnected and actively syncing
- `toast()` Sonner: `"N submissions synced"` when sync completes

**Offline banner styling:**
```tsx
// Gray — NOT red. Offline ≠ error.
<div
  role="status"
  aria-live="assertive"
  className="bg-gray-800 border-b border-gray-700 px-4 py-2.5 flex items-center gap-2"
  style={{ zIndex: Z.offlineBanner }}
>
  <WifiOff className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
  <span className="text-sm text-gray-300">
    You're offline — changes will sync when you reconnect
  </span>
  {queueCount > 0 && (
    <span className="ml-auto text-xs text-gray-500 flex-shrink-0">{queueCount} pending</span>
  )}
</div>
```

---

## 17. Navigation System

### Mobile — Bottom Tab Bar
```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-white/[0.06] shadow-[0_-4px_16px_rgba(0,0,0,0.4)] pb-safe z-[400] md:hidden">
  <div className="flex items-stretch h-14">
    {navItems.map(item => (
      <button key={item.path} className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] relative transition-colors duration-150
        ${isActive(item.path)
          ? roleAccent[role].text
          : 'text-white/40 hover:text-white/70'
        }`}>
        <item.Icon className="w-6 h-6" strokeWidth={isActive(item.path) ? 2 : 1.5} />
        <span className="text-[10px] font-medium">{item.label}</span>
        {isActive(item.path) && (
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full ${roleAccent[role].bg}`} />
        )}
      </button>
    ))}
  </div>
</nav>
```

### Desktop — Sidebar
```tsx
<aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-white/[0.06] shadow-[4px_0_24px_rgba(0,0,0,0.4)] z-[400] p-4 gap-1">
  {/* Logo */}
  {/* Nav items */}
  <NavLink className={({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150
     ${isActive ? `bg-white/10 ${roleAccent[role].text}` : 'text-white/60 hover:text-white hover:bg-white/5'}`
  }>
    <Icon className="w-5 h-5 flex-shrink-0" />
    {label}
  </NavLink>
  {/* User profile at bottom — mt-auto pushes it down */}
</aside>
```

---

## 18. Modal & Drawer Patterns

### Modal / Dialog
```tsx
// Backdrop
<motion.div variants={fadeIn} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500]" onClick={onClose} />

// Panel — full-screen mobile, centered dialog on md+
<motion.div
  variants={scaleIn}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  className="
    fixed inset-0 md:inset-auto
    md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
    md:w-[520px] md:max-h-[85vh]
    bg-gray-900 md:bg-gray-800
    md:border md:border-white/[0.08] md:rounded-2xl
    md:shadow-[0_2px_8px_rgba(0,0,0,0.6),0_16px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]
    overflow-y-auto z-[500] pb-safe md:pb-0
  "
>
  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 md:hidden" /> {/* drag handle */}
</motion.div>
```

### Drawer / Side Panel
```tsx
<motion.div
  variants={slideInRight}
  className="
    fixed right-0 top-0 bottom-0 w-full sm:w-[420px] md:w-[480px]
    bg-gray-800 border-l border-white/[0.08]
    shadow-[-8px_0_32px_rgba(0,0,0,0.5),inset_1px_0_0_rgba(255,255,255,0.04)]
    overflow-y-auto z-[500] pb-safe
  "
>
  <div className="flex items-center justify-between p-6 border-b border-white/[0.06] sticky top-0 bg-gray-800/95 z-10">
    <h2 id="drawer-title" className={typography.sectionTitle}>{title}</h2>
    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors">
      <X className="w-4 h-4" />
    </button>
  </div>
</motion.div>
```

---

## 19. Confirmation Dialog Pattern

Destructive actions (delete, reject, revoke access) always use a confirmation dialog with explicit consequence text.

```tsx
<div className={`${glass.danger} p-6 max-w-sm mx-auto`}>
  <div className="flex items-start gap-3 mb-4">
    <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
      <AlertTriangle className="w-5 h-5 text-red-400" />
    </div>
    <div>
      <h3 className={typography.cardTitle}>Delete Inspection Report?</h3>
      <p className={`${typography.body} mt-1`}>This cannot be undone. The report will be permanently removed from ATTS.</p>
    </div>
  </div>

  {/* Show exactly what will be deleted — never generic */}
  <div className="bg-gray-800 border border-white/[0.06] rounded-xl px-4 py-3 mb-6">
    <p className={typography.bodySm}>{itemDescription}</p>
  </div>

  <div className="flex gap-3 justify-end">
    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    <Button variant="danger" onClick={onConfirm} disabled={isProcessing}>
      {isProcessing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</> : 'Delete'}
    </Button>
  </div>
</div>
```

**Rules:**
- Always name the specific item being deleted — never just "Are you sure?"
- Cancel is always LEFT of the danger button
- Never auto-close on submit — wait for success/error response
- Show a spinner on the danger button while processing (not a loading overlay)

---

## 20. Data Table Pattern

```tsx
<div className="overflow-x-auto rounded-2xl border border-white/10">
  <table className="w-full min-w-[640px]">
    <thead className="bg-gray-900/50 border-b border-white/10 sticky top-0">
      <tr>
        {columns.map(col => (
          <th key={col.key} className={`px-4 py-3 text-left ${col.sortable ? 'cursor-pointer hover:bg-white/5 select-none' : ''}`}
            onClick={() => col.sortable && handleSort(col.key)}>
            <div className="flex items-center gap-1.5">
              <span className={typography.labelSm}>{col.label}</span>
              {col.sortable && (
                <span className="text-white/20 text-xs">
                  {sortField === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
    <tbody className="divide-y divide-white/[0.05]">
      {data.map(row => (
        <tr key={row.id} className="bg-gray-900 hover:bg-gray-800 transition-colors duration-100 cursor-pointer">
          {/* cells */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Table cell rules:**
- Text cells: `text-sm text-white/80 truncate max-w-[200px]`
- Date/time cells: `font-mono text-sm text-white/60` — monospace for column alignment
- Number cells: `font-mono text-sm text-white/80 text-right`
- Status cells: always `<StatusBadge>` — never plain text
- Actions cell: always last column, `text-right`, use `<DropdownMenu>` not individual icon buttons

---

## 21. Notification / Alert Banner

Distinct from toasts (ephemeral). Alert banners are persistent and tied to page context.

```tsx
const ALERT_STYLES = {
  info:    { bg: 'bg-sky-500/10    border-sky-500/20',    icon: Info,          text: 'text-sky-300'    },
  success: { bg: 'bg-green-500/10  border-green-500/20',  icon: CheckCircle2,  text: 'text-green-300'  },
  warning: { bg: 'bg-yellow-500/10 border-yellow-500/20', icon: AlertTriangle, text: 'text-yellow-300' },
  error:   { bg: 'bg-red-500/10    border-red-500/20',    icon: AlertCircle,   text: 'text-red-300'    },
} as const;

// Alert component shell
<div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${ALERT_STYLES[type].bg}`}>
  <AlertIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ALERT_STYLES[type].text}`} aria-hidden="true" />
  <div className="flex-1 min-w-0">
    {title && <p className={`text-sm font-medium ${ALERT_STYLES[type].text}`}>{title}</p>}
    <p className="text-sm text-white/70 mt-0.5">{message}</p>
  </div>
  {dismissible && (
    <button onClick={onDismiss} className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0">
      <X className="w-4 h-4" />
    </button>
  )}
</div>
```

---

## 22. Accessibility Standards

ATTS is a safety-critical application. Accessibility is a compliance concern — not a nice-to-have.

**Minimum WCAG AA contrast ratios:**
| Text + Background | Ratio | Status |
|---|---|---|
| `text-white/80` on `bg-gray-900` | ~10:1 | ✅ Passes AAA |
| `text-white/60` on `bg-gray-900` | ~6:1 | ✅ Passes AA |
| `text-white/40` on `bg-gray-900` | ~3:1 | ⚠️ Captions only — never body text |
| `text-amber-400` on `bg-gray-900` | ~5:1 | ✅ Passes AA |
| `text-red-400` on `bg-gray-900` | ~4.6:1 | ✅ Passes AA (margin is tight — don't darken bg) |
| `text-green-400` on `bg-gray-900` | ~5.2:1 | ✅ Passes AA |
| `text-blue-400` on `bg-gray-900` | ~4.8:1 | ✅ Passes AA |

**Required ARIA attributes:**
```tsx
// Loading regions
<div role="status" aria-live="polite" aria-label="Loading data...">

// Form errors
<p id="fieldName-error" role="alert">{error}</p>
<input aria-describedby="fieldName-error" aria-invalid={!!error} />

// Modals and dialogs
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">

// Offline banner (assertive — it affects form behaviour)
<div role="status" aria-live="assertive">

// Icon-only buttons
<button aria-label="Delete report"><Trash2 /></button>
```

**Focus management rules:**
- Modal open: move focus to first focusable element (or modal heading)
- Modal close: return focus to the element that triggered the modal
- Wizard step change: move focus to the new step's heading (`tabIndex={-1}` on `<h2>`)
- Form submission error: move focus to `<FormErrorBanner>` (`tabIndex={-1}`, `role="alert"`)

**Never convey meaning with color alone.** Always pair with icon or text:
- Error: red + `AlertCircle` icon + error text
- Success: green + `CheckCircle2` icon + message
- Role badge: role color + role name label

---

## 23. Mobile-First Breakpoints

Field workers use mobile. Admins use desktop. Always start with mobile, enhance up.

```
Base (< 640px):  field worker primary — glove-friendly, single-column, large touch targets
sm  (640px+):    larger phones, tablets landscape
md  (768px+):    tablet portrait, small desktop
lg  (1024px+):   desktop — admin primary
xl  (1280px+):   wide desktop
```

**Touch target minimum: 44×44px** — all interactive elements. Nav tabs: `min-h-[56px]`. Enforce with `min-h-[44px]` and `min-w-[44px]`.

**Mobile-specific layout decisions:**
- Nav: bottom tab bar mobile (`md:hidden`), sidebar desktop (`hidden md:flex`)
- Forms: single-column always on mobile. `md:grid-cols-2` only for supplemental fields
- Tables: `overflow-x-auto` wrapper always. Card list alternative on mobile for simple data
- Modals: full-screen sheet mobile, centered dialog `md:`
- FAB: mobile only, `fixed bottom-20 right-4` (above bottom nav), `md:hidden`

---

## 24. PWA Safe Areas

```tsx
// Fixed bottom elements (bottom nav, FAB, fixed CTA bars)
'pb-safe'  // tailwind-safe-area plugin
// or directly:
'pb-[env(safe-area-inset-bottom)]'
// combined with padding:
'pb-[calc(1rem+env(safe-area-inset-bottom))]'

// Top (Android status bar overlap)
'pt-safe'
```

**PWA layout checklist:**
- Bottom nav container: `pb-safe`
- Page content wrapper: `pb-20 md:pb-0` — accounts for bottom nav (safe area inside nav)
- Forms: `min-height` not `height: 100svh` — iOS keyboard pushes content
- Modals and drawers: handle `popstate` for Android back-button close
- `manifest.json` `background_color`: `#030712` (matches `bg-gray-950`) — prevents white flash on launch

---

## 25. Z-Index Layering System

Name every z-index value. Never hardcode numbers in `className`.

```ts
// src/lib/zIndex.ts
export const Z = {
  base:            0,
  card:           10,
  dropdown:      100,
  sticky:        200,    // sticky table headers, filter bars
  offlineBanner: 300,
  nav:           400,
  modal:         500,
  toast:         600,
  tooltip:       700,
} as const;

// Usage: style={{ zIndex: Z.modal }}
// Never: className="z-50"
```

---

## 26. Page Layout Pattern

Fixed structure inside `<DashboardLayout>`. Order is non-negotiable.

```
┌─────────────────────────────────────────────┐
│ Offline Banner (if offline) ← FULL WIDTH    │  conditional, always first
│─────────────────────────────────────────────│
│ Breadcrumb                                  │  if nested depth > 1
│ Page Title + Subtitle + Right Actions       │  always present
│─────────────────────────────────────────────│
│ Alert / Info Banner (page-level notice)     │  optional
│─────────────────────────────────────────────│
│ Stats Row (3–4 StatCard items)              │  optional (only if 3+ meaningful metrics)
│─────────────────────────────────────────────│
│ Filter / Search Bar                         │  list pages only
│─────────────────────────────────────────────│
│ Main Content (table / form / card grid)     │  always present
│─────────────────────────────────────────────│
│ Pagination                                  │  list pages only
└─────────────────────────────────────────────┘
```

- Offline banner is always full-width and first — never inside a card
- Page title is always in `DashboardLayout title` prop — never duplicated in content
- Right actions in header: max 2 buttons. More → overflow into a `<DropdownMenu>`
- Stats row only when 3+ genuine metrics — don't pad with meaningless numbers

---

## 27. Form Visual System

**Progress indicator:** Fixed to top of wizard. Step circles: ✓ completed (role accent fill + checkmark), ● current (role accent + subtle pulse ring), ○ upcoming (gray ring, `text-white/30`).

**Field section grouping:**
```tsx
<div className={`${glass.card} p-6 mb-4`}>
  <p className={`${typography.labelSm} text-white/40 mb-4`}>WORKER INFORMATION</p>
  {/* form fields */}
</div>
```

**Required field indicator:** `*` after label in `text-red-400` — never "required" text. Never omit it.

**Photo upload zone:**
```tsx
<div className="border-2 border-dashed border-white/[0.12] rounded-2xl p-8 bg-gray-800/60 flex flex-col items-center gap-3
  hover:border-white/25 hover:bg-gray-800 transition-all duration-150 cursor-pointer">
  <Camera className="w-8 h-8 text-white/30" aria-hidden="true" />
  <p className={typography.body}>Tap to add photo</p>
  <p className={typography.caption}>JPEG or PNG · max 10MB</p>
</div>
```

---

## 28. Print / Export Styles

OSHA safety forms are often printed for physical records or regulatory submission.

```css
/* src/styles/print.css — imported in printable form page components */
@media print {
  nav, .offline-banner, .form-actions, .wizard-progress, .no-print {
    display: none !important;
  }
  body, .glass-card {
    background: white !important;
    color: black !important;
    border-color: #ccc !important;
  }
  .page-break { page-break-before: always; }
  .print-only  { display: block !important; }
  a::after { content: none !important; } /* don't print URLs */
}
```

**Print-only elements to include in printable forms:**
- Company name + logo (text fallback)
- Form reference ID and submission date
- Submitter full name and role
- Digital signature block (if regulatory required)
- ATTS watermark footer

---

## 29. UX Specialist — Beautify Mode Quick Reference

> Summary card for fast reference during Beautify runs. Full rules are in the ★ integration section above.

### What a correct ATTS Beautify run looks like

```
BRAND DNA: (read from this file — do not re-scan)
  Background: #030712 | Accent: role-dependent (amber dominant) | Glass: @/lib/glass
  Motion: @/lib/animations | Fonts: system stack only | Direction: Dark Technical (Safety)

LAYER MAP — [page]:
  Layer 0: bg-gray-950 (DashboardLayout) — LOCKED ✓
  Layer 1: [empty / static glow present] — static radial glow only if adding
  Layer 2: glass.card surfaces — check for inline glass, replace with glass.*
  Layer 3: content ✓
  Layer 4: [noise overlay if adding — opacity 0.02, fixed, Z.card]
  Layer 5: [modals/drawers per patterns in Section 18]

✅ [PHASE 2 — LAYER 2] Unified glass usage across HistoryCard components
   → Effect: All history cards now import glass.card — consistent blur, border, radius
   → Why: 3 cards had inline bg-white/5 backdrop-blur-xl — identical values but not
     pulling from the shared constant. Future glass.card changes won't reach them.
   → Code: HistoryCard.tsx, DVIRCard.tsx, JSACard.tsx — replaced inline with glass.card
   → Next: Checking shadow consistency — cards should use shadows.card from @/lib/shadows
```

### Fastest high-impact changes for ATTS pages

1. **Audit surfaces** — Find any `backdrop-blur`, `bg-white/[N]` on card/panel backgrounds — replace with `glass.card` or `glass.elevated`
2. **Add shadows.card** — Cards missing `shadow-lg shadow-black/20` feel flat against the dark bg
3. **Unify typography** — Replace ad-hoc `text-xs font-medium uppercase` with `typography.labelSm`
4. **Role-accent hover on cards** — `hover:border-[roleColor]/40 hover:shadow-lg hover:shadow-[roleColor]/10`
5. **Static Layer 1 glow** — One `radial-gradient` in role accent color, `opacity: 0.05`, no animation

---

## Quick Reference — Rules Summary

| ✅ Always | ❌ Never |
|---|---|
| `focus-visible:ring-*` for keyboard rings | `focus:ring-*` (shows on every tap) |
| `logger.*` for all logging | `console.*` in production |
| `formToast` for form submissions | `toast` (Sonner) for form submissions |
| `text-base` on `<input>` elements | `text-sm` on inputs (triggers iOS zoom) |
| `Z.*` constants for z-index | Hardcoded z-index numbers |
| `useReducedMotion()` wrapping all Framer animations | Skip reduced motion check |
| Skeleton shapes that match content | Centered spinner for page data |
| `disabled:pointer-events-none` on buttons | `pointer-events-none` alone |
| `active:scale-[0.98]` for button press | Framer Motion for simple button feedback |
| Role color + role label together | Role color alone to convey meaning |
| Icon + color + text for semantic states | Color alone for error/success/warning |
| `ROLE_BADGE_STYLES[role]` from shared map | Inline role-color classes |
| Import `glass.*`, `typography.*`, `Z.*` | Freestyle Tailwind on major surfaces |
| `style={{ zIndex: Z.* }}` for layer control | `className="z-[N]"` hardcoded numbers |
| Static radial gradients for Layer 1 depth | Animated blobs / particle fields (Android perf) |
| Custom SVG icons in `src/components/icons/` | Generic lucide icons for feature/decorative use |
| System font stack | Custom font imports (PWA load time) |
