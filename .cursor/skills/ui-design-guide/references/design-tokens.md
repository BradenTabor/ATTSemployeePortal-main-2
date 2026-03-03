# Reference: Design Tokens Quick Reference

Copy-paste reference for the most commonly needed design values. All tokens are also defined in `src/lib/` — import from there rather than hardcoding.

---

## Glass Card Classes

```tsx
// Import from: @/lib/glass
export const glass = {
  card:     'backdrop-blur-xl  bg-white/5        border border-white/10  rounded-2xl',
  elevated: 'backdrop-blur-2xl bg-white/[0.08]   border border-white/15  rounded-2xl shadow-2xl shadow-black/40',
  subtle:   'backdrop-blur-md  bg-white/[0.03]   border border-white/[0.08] rounded-xl',
  danger:   'backdrop-blur-xl  bg-red-500/10     border border-red-500/20  rounded-2xl',
  success:  'backdrop-blur-xl  bg-green-500/10   border border-green-500/20 rounded-2xl',
} as const;
```

---

## Role Accent Colors (CORRECTED v2.0)

```tsx
// Import from: @/lib/roleAccent (or define here)
export const roleAccent = {
  admin:            { text: 'text-amber-400',  bg: 'bg-amber-500',  muted: 'bg-amber-500/20  border-amber-500/30'  },
  safety_officer:   { text: 'text-red-400',    bg: 'bg-red-600',    muted: 'bg-red-600/20    border-red-500/30'    },
  foreman:          { text: 'text-blue-400',   bg: 'bg-blue-600',   muted: 'bg-blue-600/20   border-blue-500/30'   },
  employee:         { text: 'text-green-400',  bg: 'bg-green-600',  muted: 'bg-green-600/20  border-green-500/30'  },
  mechanic:         { text: 'text-orange-400', bg: 'bg-orange-500', muted: 'bg-orange-500/20 border-orange-500/30' },
  general_foreman:  { text: 'text-purple-300', bg: 'bg-purple-600', muted: 'bg-purple-600/20 border-purple-500/30' },
  manager:          { text: 'text-teal-400',   bg: 'bg-teal-600',   muted: 'bg-teal-600/20   border-teal-500/30'   },
} as const;
```

## Role Badge Styles

```tsx
export const ROLE_BADGE_STYLES = {
  admin:            'bg-amber-500/20  text-amber-400  border border-amber-500/30',
  safety_officer:   'bg-red-600/20    text-red-400    border border-red-500/30',
  foreman:          'bg-blue-600/20   text-blue-400   border border-blue-500/30',
  employee:         'bg-green-600/20  text-green-400  border border-green-500/30',
  mechanic:         'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  general_foreman:  'bg-purple-600/20 text-purple-300 border border-purple-500/30',
  manager:          'bg-teal-600/20   text-teal-400   border border-teal-500/30',
} as const;

// Badge usage:
<span className={`${ROLE_BADGE_STYLES[role]} text-xs font-medium px-2 py-0.5 rounded-full`}>
  {role.replace('_', ' ')}
</span>
```

---

## Status Badge Styles

```tsx
export const STATUS_BADGE_STYLES = {
  submitted:  'bg-blue-500/20   text-blue-400   border border-blue-500/30',
  approved:   'bg-green-500/20  text-green-400  border border-green-500/30',
  rejected:   'bg-red-500/20    text-red-400    border border-red-500/30',
  pending:    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  draft:      'bg-gray-500/20   text-gray-400   border border-gray-500/30',
  queued:     'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  expired:    'bg-orange-500/20 text-orange-400 border border-orange-500/30',
} as const;
```

---

## Button Classes

```tsx
// Size variants
const buttonSize = {
  sm: 'px-3 py-1.5 text-xs  rounded-lg  min-h-[32px]',
  md: 'px-4 py-2.5 text-sm  rounded-xl  min-h-[40px]',  // default
  lg: 'px-6 py-3   text-base rounded-xl min-h-[48px]',
} as const;

// Style variants
const buttonVariant = {
  primary:   'bg-blue-600   hover:bg-blue-500   active:bg-blue-700   text-white font-semibold transition-colors duration-150',
  secondary: 'bg-white/10  hover:bg-white/15   active:bg-white/20   text-white font-medium border border-white/10 transition-colors duration-150',
  ghost:     'hover:bg-white/10 active:bg-white/15 text-white/70 hover:text-white font-medium transition-all duration-150',
  danger:    'bg-red-600    hover:bg-red-500    active:bg-red-700    text-white font-semibold transition-colors duration-150',
} as const;

// Disabled — append to ALL variants:
const buttonDisabled = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';
```

---

## Input Field Classes

```tsx
// Base input
const input = {
  base:     'w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-base text-white placeholder:text-white/30 focus:outline-none focus-visible:border-blue-500/50 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all duration-150',
  error:    'border-red-500/50 focus-visible:border-red-500/70 focus-visible:ring-red-500/20',
  success:  'border-green-500/50 focus-visible:border-green-500/70 focus-visible:ring-green-500/20',
  disabled: 'opacity-50 cursor-not-allowed bg-gray-900 select-none',
} as const;
```

---

## Typography Classes

```tsx
// Import from: @/lib/typography
export const typography = {
  pageTitle:    'text-2xl   font-bold     text-white     leading-tight',
  sectionTitle: 'text-xl    font-semibold text-white     leading-snug',
  cardTitle:    'text-lg    font-semibold text-white     leading-snug',
  bodyLg:       'text-base  font-normal   text-white/80  leading-relaxed',
  body:         'text-sm    font-normal   text-white/80  leading-relaxed',
  bodySm:       'text-xs    font-normal   text-white/60  leading-relaxed',
  label:        'text-sm    font-medium   text-white/80',
  labelSm:      'text-xs    font-medium   text-white/60  uppercase tracking-wider',
  caption:      'text-xs    font-normal   text-white/40',
  mono:         'text-sm    font-mono     text-white/70',
  code:         'text-xs    font-mono     text-white/70  bg-white/10 px-1.5 py-0.5 rounded',
  link:         'text-sm    font-medium   text-blue-400  hover:text-blue-300 underline-offset-2 hover:underline transition-colors',
} as const;
```

---

## Framer Animation Presets

```tsx
// Import from: @/lib/animations
import { fadeIn, slideInUp, slideInLeft, slideInRight, scaleIn, staggerContainer } from '@/lib/animations';

// Page content
<motion.div variants={slideInUp} initial="hidden" animate="visible" exit="exit">

// Modal
<motion.div variants={scaleIn} initial="hidden" animate="visible" exit="exit">

// Drawer (slides from right)
<motion.div variants={slideInRight} initial="hidden" animate="visible" exit="exit">

// Staggered card list
<motion.div variants={staggerContainer} initial="hidden" animate="visible">
  {items.map(i => <motion.div key={i.id} variants={slideInUp}>...</motion.div>)}
</motion.div>

// Always wrap with reduced motion check:
const shouldReduce = useReducedMotion();
<motion.div variants={shouldReduce ? {} : slideInUp} initial="hidden" animate="visible">
```

---

## Shadow Classes

```tsx
// Import from: @/lib/shadows
export const shadows = {
  none:     '',
  sm:       'shadow-sm shadow-black/20',
  card:     'shadow-lg shadow-black/20',
  elevated: 'shadow-2xl shadow-black/40',
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
```

---

## Skeleton Shapes

```tsx
// Text lines — vary widths for natural staggered look
<div className="h-4 bg-white/10 animate-pulse rounded w-3/4 mb-2" />
<div className="h-4 bg-white/10 animate-pulse rounded w-1/2" />

// Card block
<div className="h-32 bg-white/5 animate-pulse rounded-2xl border border-white/10" />

// Avatar / circle
<div className="w-10 h-10 bg-white/10 animate-pulse rounded-full flex-shrink-0" />

// Table row
<div className="h-12 bg-white/5 animate-pulse rounded-lg" />

// Stat number
<div className="h-8 w-16 bg-white/10 animate-pulse rounded" />
```

---

## Z-Index Reference

```tsx
// Import from: @/lib/zIndex
import { Z } from '@/lib/zIndex';

// style={{ zIndex: Z.modal }}  ← always use named constants, never hardcode

// Z.base = 0
// Z.card = 10
// Z.dropdown = 100
// Z.sticky = 200   (table headers, filter bars)
// Z.offlineBanner = 300
// Z.nav = 400
// Z.modal = 500
// Z.toast = 600
// Z.tooltip = 700
```

---

## Icon Sizes by Context

```tsx
// Empty state illustration
<Icon className="w-8 h-8 opacity-50" />

// Card / section header
<Icon className="w-6 h-6 text-white/40" strokeWidth={1.5} />

// Standard button / nav item
<Icon className="w-5 h-5" />

// Inline with body text / table cell
<Icon className="w-4 h-4 flex-shrink-0" />

// Validation error / caption
<Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
```

---

## Common Lucide Icons Quick Reference

```tsx
// Navigation & layout
LayoutDashboard, FileText, Users, Settings, Shield, Truck, TreePine, AlertTriangle

// CRUD actions
Plus, Edit2, Trash2, Eye, Copy, MoreHorizontal

// Data & filters
Search, Filter, SlidersHorizontal, Download, Upload, RefreshCw, ChevronDown, ChevronRight

// Status
CheckCircle2, XCircle, AlertCircle, Clock, Loader2, Info, AlertTriangle, Check

// Offline / sync
WifiOff, Wifi, CloudOff, UploadCloud, RefreshCw

// Forms & fields
Clipboard, Camera, MapPin, Calendar, User, Phone, Lock, Mail

// UI chrome
X, ChevronLeft, ChevronRight, ArrowLeft, Menu, Grid, List
```
