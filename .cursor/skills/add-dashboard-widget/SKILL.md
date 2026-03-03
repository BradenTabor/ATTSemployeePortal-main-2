---
name: add-dashboard-widget
description: Scaffold a self-contained dashboard widget card for ATTS — with internal React Query data fetching, consistent loading/error/empty states, dark theme styling (rounded-xl border-white/10 bg-white/[0.03]), timezone-aware dates, and responsive grid integration.
triggers:
  - "add dashboard widget"
  - "create widget"
  - "new dashboard card"
  - "dashboard component"
  - "safety metric widget"
version: 1.0
reviewed: 2026-02-17
---

# Add Dashboard Widget

## Purpose
Scaffolds a self-contained dashboard widget following the pattern used by the 9 existing widgets in `src/components/dashboard/`. Widgets are zero-prop components that fetch their own data — consistency in loading/error/empty states and card styling is what makes the dashboard feel like a cohesive product.

## Pre-Flight Checklist
- [ ] Widget name — PascalCase (e.g., `TrainingCompletionRate`)
- [ ] Data source — which Supabase table or RPC?
- [ ] Query key — e.g., `["training_completion_rate"]`
- [ ] What does the widget display? (single number, list, chart, progress bar?)
- [ ] Which dashboard page(s) should it appear on?

---

## Architecture

Widgets in ATTS are self-contained:
- They accept no props (zero-prop pattern)
- They fetch their own data via React Query
- They handle their own loading, error, and empty states
- They are composed into dashboard pages via responsive CSS grid

---

## File to Create

`src/components/dashboard/<WidgetName>.tsx`

See `references/widget-template.md` for the full template.

---

## Step-by-Step

### 1. Create the Widget Component

Key rules:
- Import `useQuery` from `@tanstack/react-query`
- Import `supabase` from `@/lib/supabaseClient`
- Use a descriptive query key: `["entity_name_metric"]`
- Set `staleTime` to 5 minutes for non-critical data, 1 minute for real-time data
- Handle all 3 states (loading, error, data) — each wrapped in the same card

### 2. Card Styling (Non-Negotiable)

Every widget must use this exact card wrapper for visual consistency:

```tsx
<div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
  <h3 className="text-sm font-semibold text-white/90 mb-3">Widget Title</h3>
  {/* Content */}
</div>
```

Do NOT use:
- Gold theme colors (those are for admin pages, not dashboard widgets)
- Custom border radius values
- Shadows or elevation (the subtle border is the design language)

### 3. Loading State

```tsx
if (isLoading) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white/90 mb-3">Widget Title</h3>
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" aria-hidden />
      </div>
    </div>
  );
}
```

### 4. Error State

```tsx
if (error) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white/90 mb-3">Widget Title</h3>
      <div className="flex items-center gap-2 py-4 text-red-400 text-sm">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span>{error instanceof Error ? error.message : 'Failed to load data'}</span>
      </div>
    </div>
  );
}
```

### 5. Empty State

```tsx
if (!data || data.length === 0) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white/90 mb-3">Widget Title</h3>
      <p className="text-sm text-white/50 py-4">No data available yet.</p>
    </div>
  );
}
```

### 6. Timezone Handling

All date comparisons must use Central Time:
```tsx
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Chicago";
const now = toZonedTime(new Date(), TZ);
```

### 7. Integrate into Dashboard Page

In the target dashboard page (e.g., `SafetyOfficerDashboard.tsx`):

```tsx
import <WidgetName> from "../../components/dashboard/<WidgetName>";

// Inside the grid section:
<section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
  <ExistingWidget />
  <<WidgetName> />
</section>
```

Grid patterns by widget size:
- **Small** (single number, badge): fits in `grid-cols-4`
- **Medium** (list, progress bar): fits in `grid-cols-2`
- **Large** (chart, table): use `lg:col-span-2` or full width

---

## Widget Type Patterns

### Single Metric (e.g., DaysSinceIncident)
```tsx
<div className="text-center py-2">
  <span className="text-4xl font-black text-emerald-400">{count}</span>
  <p className="text-xs text-white/50 mt-1">days since last incident</p>
</div>
```

### List Widget (e.g., OverdueFormAlerts)
```tsx
<ul className="space-y-2 max-h-48 overflow-y-auto">
  {items.map((item) => (
    <li key={item.id} className="flex items-center justify-between text-sm">
      <span className="text-white/80">{item.name}</span>
      <span className="text-red-400 text-xs">{item.status}</span>
    </li>
  ))}
</ul>
```

### Progress/Rate Widget (e.g., ComplianceRatesWidget)
```tsx
<div className="space-y-3">
  {rates.map((rate) => (
    <div key={rate.label}>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/70">{rate.label}</span>
        <span className="text-white/90 font-medium">{rate.pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400"
          style={{ width: `${rate.pct}%` }}
        />
      </div>
    </div>
  ))}
</div>
```

---

## Color Semantic Guide

| Color | Use |
|-------|-----|
| `text-emerald-400` | Positive metrics, progress bars, success |
| `text-amber-400` | Warnings, approaching thresholds |
| `text-red-400` | Errors, overdue items, critical alerts |
| `text-white/90` | Primary text |
| `text-white/50` | Secondary/muted text |
| `bg-white/[0.03]` | Card background |
| `border-white/10` | Card border |

---

## After Creation Checklist

- [ ] Widget is self-contained (no props required)
- [ ] React Query used with descriptive query key
- [ ] `staleTime` set appropriately (1-5 min)
- [ ] Loading state shows `Loader2` spinner with `animate-spin text-emerald-400`
- [ ] Error state shows `AlertTriangle` with `text-red-400`
- [ ] Empty state shows muted message with `text-white/50`
- [ ] All 3 states use the same card wrapper
- [ ] Card uses `rounded-xl border border-white/10 bg-white/[0.03] p-4`
- [ ] Dates use `toZonedTime` with `America/Chicago`
- [ ] Widget imported and placed in the target dashboard page grid
- [ ] No `console.*` — use `logger.*` if logging needed
- [ ] `npx tsc --noEmit` passes

## Anti-Patterns

- **Never** accept props for data — widgets fetch their own data
- **Never** use gold theme colors in widgets — gold is for admin page headers
- **Never** skip the error state — a crashed widget with no feedback is worse than an error message
- **Never** use a custom card wrapper — the inline `rounded-xl border border-white/10 bg-white/[0.03] p-4` must be consistent
- **Never** use `new Date()` without timezone conversion for Central Time comparisons
