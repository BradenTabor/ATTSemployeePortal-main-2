---
name: scaffold-admin-page
description: Scaffold a new ATTS admin page with role-gated routing, premium glass header (gold theme), data table with sortable headers + mobile card view, search/filter with debounce, pagination, CSV/PDF export via DataExporter, and Framer Motion animations — following the established AdminUsers pattern.
triggers:
  - "create admin page"
  - "new admin dashboard"
  - "add admin section"
  - "scaffold admin"
  - "admin table page"
version: 1.0
reviewed: 2026-02-17
---

# Scaffold Admin Page

## Purpose
Creates a fully-featured admin page matching the gold-themed, glass-morphism pattern used by the 19 existing admin pages. Skipping any piece (role gate, export, mobile cards) creates a visually jarring or functionally broken experience.

## Pre-Flight Checklist
- [ ] `<PageName>` — PascalCase (e.g., `AdminIncidentTracker`)
- [ ] Route path — e.g., `/admin/incident-tracker`
- [ ] Required role(s) — `admin` only, or `["admin", "safety_officer"]`?
- [ ] Data source — which Supabase table or RPC?
- [ ] Column definitions — list each column with label, field, sortable?
- [ ] Filter fields — which columns are searchable/filterable?
- [ ] Export needed? (assume yes unless told no)

---

## Files to Create

### 1. Page Component (`src/pages/admin/<PageName>.tsx`)

See `references/admin-page-template.md` for the full template.

Key rules:
- Wrap in `<DashboardLayout title="Page Title">`
- Add defensive role check at top of component (early return with Access Denied)
- Use the premium glass header with gold theme — see template for exact gradient values
- Data table: desktop `<table>` + mobile card fallback via `md:hidden` / `hidden md:block`
- Sortable headers: use `SortableHeader` sub-component pattern
- Search: `useDebouncedValue(searchQuery, 300)` — reset page to 1 on filter change
- Pagination: standard `currentPage` / `pageSize` pattern
- Animations: `motion.tr` with staggered `delay: index * 0.03`
- Keep file under 600 lines. Extract mobile cards or complex cells into sub-components if needed

### 2. Route Registration (`src/App.tsx`)

Add lazy import and route:
```tsx
const <PageName> = lazy(() => import('./pages/admin/<PageName>'));

<Route path="/admin/<route-path>" element={
  <PageWrapper><ProtectedRoute requiredRole="admin"><PageName /></ProtectedRoute></PageWrapper>
} />
```

For multi-role access, use `allowedRoles={["admin", "safety_officer"]}`.

### 3. Nav Config (optional — `src/components/admin/adminNavConfig.tsx`)

Add entry to `ADMIN_CORE_NAV_CARDS`:
```tsx
{
  title: "Page Title",
  description: "One-line description.",
  icon: <IconComponent className="w-6 h-6" />,
  to: "/admin/<route-path>",
  variant: "gold",
}
```

---

## Export Integration

See `references/export-pattern.md` for the full CSV/PDF export setup.

Key rules:
- Import `DataExporter` and `generateFilename` from `@/lib/exportUtils`
- Define separate column arrays for CSV and PDF (PDF may need fewer columns for width)
- Include `ExportMetadata` with `reportType`, `generatedAt`, `exportedBy`, `filters`, `totalRecords`
- Show loading spinner on export button during generation
- Disable export when `data.length === 0`

---

## Styling Rules (Gold Theme)

These values are non-negotiable for visual consistency:
- Header gradient: `linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)`
- Backdrop filter: `blur(24px) saturate(1.6)`
- Gold accent: `#f4c979`
- Gold text light: `#f8e5bb`
- Gold text muted: `#f8e5bb/50`
- Table header: `bg-gradient-to-r from-[#2b251b] to-[#1b1812]`
- Border colors: `border-[#f6dcb2]/15` or `border-white/[0.12]`
- Badge chip: `bg-[#f4c979]/15 border border-[#f4c979]/30`
- Row hover: `hover:bg-white/5`
- Background: `bg-[#050402]/70` for inputs

---

## After Creation Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] Route added to `src/App.tsx` with `ProtectedRoute`
- [ ] Role check at component level (defensive — in case route protection is bypassed)
- [ ] Table renders on desktop, cards render on mobile
- [ ] Export buttons disabled when no data
- [ ] Search debounced at 300ms
- [ ] Pagination resets to page 1 on filter change
- [ ] No `console.*` — use `logger.*`

## Anti-Patterns

- **Never** skip the mobile card view — field workers use phones
- **Never** hardcode gold color values inline — use the exact hex values from the styling rules above for consistency
- **Never** skip `useDebouncedValue` for search — direct search on keystroke hammers the render loop
- **Never** put data fetching in the page component — use a query hook from `src/hooks/queries/`
