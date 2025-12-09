# Bundle Analysis Report - ATTS Employee Portal

Generated: December 9, 2025

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total JS Bundle Size (minified)** | ~1.1 MB |
| **Total JS Bundle Size (gzipped)** | ~332 KB |
| **Largest Vendor Chunk** | vendor-supabase (186 KB / 48 KB gzip) |
| **Main Entry Point** | index (59 KB / 18 KB gzip) |
| **CSS** | 116 KB / 16 KB gzip |

## Bundle Breakdown (Top 20 Largest Chunks)

| Rank | Chunk | Size (min) | Size (gzip) | Type |
|------|-------|-----------|-------------|------|
| 1 | vendor-supabase | 186 KB | 48 KB | Vendor |
| 2 | vendor-react | 175 KB | 57 KB | Vendor |
| 3 | vendor-motion | 119 KB | 40 KB | Vendor |
| 4 | ExpandableSection | 59 KB | 14 KB | Component |
| 5 | index (main) | 59 KB | 18 KB | Entry |
| 6 | JobDetailExpanded | 53 KB | 12 KB | Component |
| 7 | DailyJSAForm | 36 KB | 10 KB | Page |
| 8 | vendor-utils | 35 KB | 12 KB | Vendor |
| 9 | DVIRForm | 32 KB | 8 KB | Page |
| 10 | MechanicDVIRCenter | 31 KB | 8 KB | Page |
| 11 | vendor-query | 26 KB | 8 KB | Vendor |
| 12 | DailyEquipmentInspectionForm | 22 KB | 6 KB | Page |
| 13 | DVIRHistory | 21 KB | 6 KB | Page |
| 14 | MechanicEquipmentCenter | 21 KB | 6 KB | Page |
| 15 | AdminJSA | 21 KB | 6 KB | Page |
| 16 | dashboard-* (4 chunks) | ~50 KB | ~16 KB | Dashboard |
| 17 | Announcements | 18 KB | 5 KB | Page |
| 18 | AdminPremiumScaffold | 18 KB | 5 KB | Component |
| 19 | AdminRTO | 17 KB | 5 KB | Page |
| 20 | AdminJobTracker | 16 KB | 5 KB | Page |

## Current Optimizations (Already in Place)

1. **Route-level code splitting** - All pages use `React.lazy()` ✓
2. **Vendor chunking** - Manual chunks for React, Supabase, Motion, Query, Forms, Utils ✓
3. **Lucide icon tree-shaking** - Icons split into tiny individual chunks (~0.2-0.5 KB each) ✓
4. **CSS code splitting** enabled ✓
5. **Modern ES2020 target** for smaller polyfill footprint ✓
6. **Production console/debugger stripping** via esbuild ✓

---

## Prioritized Recommendations

### 1. Remove Unused Dependencies (Easy Win)
**Risk: Low | Estimated Savings: ~150-200 KB**

The following packages are in `package.json` but NOT imported anywhere in the source code:

```
jspdf (PDF generation) - ~90 KB
jspdf-autotable (PDF tables) - ~60 KB
```

**Action:**
```bash
npm uninstall jspdf jspdf-autotable
```

Also remove the jspdf alias from `vite.config.ts`:
```diff
- 'jspdf': path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.es.min.js'),
```

---

### 2. Lazy-Load ReactQueryDevtools (Easy Win)
**Risk: Low | Estimated Savings: ~20-30 KB from main bundle**

Currently, `ReactQueryDevtools` is statically imported but only rendered in dev mode. This adds weight to the production build's parse time.

**See DIFF #1 below**

---

### 3. Consider Lighter Animation Alternative
**Risk: Medium | Estimated Savings: ~80-100 KB**

`framer-motion` is 119 KB minified. If animation requirements are simple, consider:
- **motion** (from framer-motion/mini) - lighter subset
- **CSS transitions/animations** - zero JS overhead
- **@formkit/auto-animate** - ~4 KB

However, this app uses framer-motion extensively (AnimatePresence, spring physics, gesture handlers), so the migration cost is high. **Recommend keeping for now** unless bundle size is critical.

---

### 4. Lazy-Load JobDetailExpanded (Moderate Win)
**Risk: Low | Estimated Savings: ~53 KB deferred load**

`JobDetailExpanded` (53 KB) is only rendered when a user clicks to expand a job card. This is a good candidate for dynamic import.

**See DIFF #2 below**

---

### 5. Split vendor-supabase Further (Advanced)
**Risk: Medium | Estimated Savings: Deferred loading**

The Supabase client (186 KB) is loaded upfront. If auth is the only initial requirement, consider:
- Lazy-load realtime/storage modules only when needed
- Use Supabase Edge Functions to reduce client-side logic

This requires architectural changes and is **not recommended for immediate implementation**.

---

### 6. Consider date-fns Subpath Imports (Minor Win)
**Risk: Low | Estimated Savings: ~10-15 KB**

The app already uses `date-fns` (in vendor-utils at 35 KB). Tree-shaking should handle this, but verify only needed functions are imported:

```typescript
// Instead of
import { format, parseISO } from 'date-fns';

// Consider explicit subpath (though modern bundlers handle this)
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
```

---

## Unified Diffs

### DIFF #1: Lazy-Load ReactQueryDevtools

This change makes ReactQueryDevtools load only when needed in development, removing it entirely from the production bundle parse.

```diff
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -5,8 +5,8 @@ import {
   useLocation,
 } from "react-router-dom";
 import { QueryClientProvider } from "@tanstack/react-query";
-import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
 import { motion, AnimatePresence } from "framer-motion";
-import { Suspense, lazy } from "react";
+import { Suspense, lazy, useState, useEffect } from "react";
 import ProtectedRoute from "./components/ProtectedRoute";
 import SessionOverlay from "./components/SessionOverlay";
 import LoadingScreen from "./components/LoadingScreen";
@@ -14,6 +14,16 @@ import { useAuth } from "./contexts/AuthContext";
 import { Toaster } from "./components/ui/Toaster";
 import { queryClient } from "./lib/queryClient";
 
+// Lazy load devtools only in development
+const ReactQueryDevtoolsLazy = lazy(() =>
+  import("@tanstack/react-query-devtools").then((mod) => ({
+    default: mod.ReactQueryDevtools,
+  }))
+);
+
+// Simple wrapper that only loads in dev
+const DevtoolsWrapper = () => import.meta.env.DEV ? <ReactQueryDevtoolsLazy initialIsOpen={false} position="bottom" buttonPosition="bottom-right" /> : null;
+
 // Main pages
 const Home = lazy(() => import("./pages/Home"));
 const Dashboard = lazy(() => import("./pages/Dashboard"));
@@ -453,13 +463,11 @@ export default function App() {
     <QueryClientProvider client={queryClient}>
       <Router>
         <AnimatedRoutes />
       </Router>
       <Toaster />
       {/* DevTools - only renders in development */}
-      {import.meta.env.DEV && (
-        <ReactQueryDevtools
-          initialIsOpen={false}
-          position="bottom"
-          buttonPosition="bottom-right"
-        />
+      {import.meta.env.DEV && (
+        <Suspense fallback={null}>
+          <DevtoolsWrapper />
+        </Suspense>
       )}
     </QueryClientProvider>
   );
```

---

### DIFF #2: Lazy-Load JobDetailExpanded

This change defers loading the JobDetailExpanded component until the user actually expands a job.

```diff
--- a/src/pages/Dashboard.tsx
+++ b/src/pages/Dashboard.tsx
@@ -1,4 +1,4 @@
-import { useState, useMemo, Suspense, lazy, memo, useCallback } from "react";
+import { useState, useMemo, Suspense, lazy, memo, useCallback, ComponentType } from "react";
 import { useNavigate } from "react-router-dom";
 import { motion, AnimatePresence } from "framer-motion";
 import {
@@ -29,9 +29,16 @@ import {
   ExpandableScreenTrigger,
   ExpandableScreenContent,
 } from '../components/ui/ExpandableScreen';
-import { JobDetailExpanded } from '../components/jobs/JobDetailExpanded';
 import type { JobProgressTracker } from '../types/jobs';
 
+// Lazy load the expanded job detail view (only when user expands a job)
+const JobDetailExpanded = lazy(() => 
+  import('../components/jobs/JobDetailExpanded').then((mod) => ({
+    default: mod.JobDetailExpanded as ComponentType<{ job: JobProgressTracker }>,
+  }))
+);
+
 // Lazy-loaded components
 const NavCards = lazy(() => import("../components/NavCards"));
 const DashboardAnnouncementCard = lazy(
@@ -115,7 +122,11 @@ function JobCardWithExpand({ job, onExpandStart }: JobCardWithExpandProps) {
       <ExpandableScreenTrigger />
       <ExpandableScreenContent className="bg-gradient-to-br from-[#041812] via-[#020d09] to-[#010604]">
-        <JobDetailExpanded job={job} />
+        <Suspense fallback={
+          <div className="flex items-center justify-center min-h-[200px]">
+            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-400"></div>
+          </div>
+        }>
+          <JobDetailExpanded job={job} />
+        </Suspense>
       </ExpandableScreenContent>
     </ExpandableScreen>
```

---

## Build Commands

### Generate Production Build
```bash
npm run build
```

### Generate Build with Source Maps (for analysis)
```bash
# Temporarily set in vite.config.ts:
# sourcemap: true

npm run build
```

### Analyze with source-map-explorer
```bash
npm install -D source-map-explorer
npx source-map-explorer dist/assets/index-*.js
```

### Analyze with rollup-plugin-visualizer
```bash
npm install -D rollup-plugin-visualizer

# Add to vite.config.ts plugins:
# import { visualizer } from 'rollup-plugin-visualizer';
# visualizer({ open: true, filename: 'bundle-report.html', gzipSize: true })

npm run build
# Opens bundle-report.html automatically
```

---

## Summary of Actions

| Action | Priority | Savings | Risk | Effort |
|--------|----------|---------|------|--------|
| Remove jspdf/jspdf-autotable | High | 150 KB | Low | 5 min |
| Lazy-load ReactQueryDevtools | Medium | 20-30 KB | Low | 10 min |
| Lazy-load JobDetailExpanded | Medium | 53 KB deferred | Low | 15 min |
| Review date-fns imports | Low | 10-15 KB | Low | 30 min |
| Replace framer-motion | Low | 80-100 KB | High | Days |

**Total Immediate Savings Potential: ~170-180 KB (before gzip)**

