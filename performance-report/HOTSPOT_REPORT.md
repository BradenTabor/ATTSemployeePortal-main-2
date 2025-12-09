# ATTS Employee Portal - Performance Hotspot Report

**Generated:** December 9, 2025  
**Analyzed Pages:** Home, Dashboard, Forms, Announcements, Admin (Users, RTO), Mechanic DVIR Center, DVIR Form  
**Test Environment:** Production build served via Vite preview (http://127.0.0.1:4173)

---

## Executive Summary

The ATTS Employee Portal demonstrates **excellent overall performance** with Lighthouse scores consistently above 90%. However, there are **10 actionable hotspots** that can further improve the user experience, particularly on mobile devices and during navigation transitions.

### Key Metrics

| Metric | Mobile | Desktop | Target |
|--------|--------|---------|--------|
| **Performance Score** | 94 | 100 | >90 ✅ |
| **FCP** | 2.2s | 0.5s | <1.8s ⚠️ |
| **LCP** | 2.7s | 0.6s | <2.5s ⚠️ |
| **TBT** | 0ms | 0ms | <200ms ✅ |
| **CLS** | 0 | 0 | <0.1 ✅ |
| **TTI** | 2.7s | 0.6s | <3.8s ✅ |

### Top Issues

1. **Unused JavaScript** - ~60 KiB could be removed (High Impact)
2. **Long Main-Thread Tasks** - Up to 123ms blocking during navigation (High Impact)
3. **Render-blocking CSS** - 150ms potential savings (Medium Impact)
4. **GC Pauses** - 34ms Major GC during scroll (Medium Impact)
5. **Heavy Animation Component** - DashboardAvatar has 2000 lines of complex SVG animations

---

## Detailed Hotspot Analysis

### 1. Unused JavaScript (HIGH PRIORITY)

**Impact:** ~450ms potential savings on mobile  
**Risk:** Medium  
**Location:** Multiple vendor chunks

The build analysis shows significant unused JavaScript, primarily from:
- `vendor-motion-C7t7z-th.js` (119 KB gzipped: 40 KB) - framer-motion
- `vendor-supabase-Bs-QIGsW.js` (186 KB gzipped: 48 KB) - Supabase client
- `vendor-react-BBVvs-kr.js` (174 KB gzipped: 57 KB) - React core

**Root Cause:** These vendor chunks are loaded upfront even though not all features are used on initial load.

**Recommendation:**

```typescript
// src/App.tsx - Already using lazy loading, but can be more aggressive

// Current: All routes load motion, supabase, etc. upfront
// Better: Defer non-critical imports

// For framer-motion - use dynamic import for heavy animations
const DashboardAvatar = lazy(() => 
  import('./components/dashboard/DashboardAvatar')
);

// For Supabase - consider lazy initialization for auth-required features
const supabasePromise = import('./lib/supabaseClient').then(m => m.supabase);
```

**Validation:** Re-run Lighthouse - unused-javascript score should improve to >50

---

### 2. Long Main-Thread Tasks (HIGH PRIORITY)

**Impact:** 15-30% reduction in perceived jank  
**Risk:** Low  
**Location:** Navigation transitions, Dashboard rendering

**Trace Evidence:**
- `navigation-stress.trace.json`: 123ms, 120ms, 79ms tasks
- `dashboard.trace.json`: 109ms, 55ms, 51ms tasks
- `scroll-stress.trace.json`: 94ms, 75ms, 58ms tasks

**Root Cause:** Route transitions with framer-motion's AnimatePresence trigger expensive layout calculations. Multiple components re-render simultaneously.

**Recommendation:**

```typescript
// src/App.tsx - Optimize AnimatePresence
// Current pageTransition causes all route content to animate

const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.3, ease: "easeInOut" }, // Already optimized
};

// Consider: Use `mode="popLayout"` instead of "wait" for smoother transitions
<AnimatePresence mode="popLayout">
  {/* routes */}
</AnimatePresence>

// Or: Skip exit animations on mobile
const prefersReducedMotion = useReducedMotion();
<AnimatePresence mode={prefersReducedMotion ? "sync" : "wait"}>
```

```typescript
// src/pages/Dashboard.tsx - Break up heavy initial render
// Add startTransition for non-critical updates

import { startTransition, useCallback } from 'react';

// When fetching jobs, defer state update
const {
  assignedJobs,
  loading: jobsLoading,
  error: jobsError,
  refetch: refetchJobs,
} = useUserAssignedJobs(user?.id);

// Wrap non-critical state updates
startTransition(() => {
  // Heavy computations or state updates here
});
```

**Validation:** Re-profile navigation - task durations should be <50ms

---

### 3. Render-Blocking CSS (MEDIUM PRIORITY)

**Impact:** 150ms potential FCP improvement on mobile  
**Risk:** Low  
**Location:** `index-fnksIafW.css` (116 KB)

**Root Cause:** The entire CSS bundle blocks rendering. Critical CSS is not inlined.

**Recommendation:**

```html
<!-- index.html - Inline critical CSS -->
<head>
  <style>
    /* Critical above-the-fold CSS - approx 2-3KB */
    body { margin: 0; background: #010604; color: white; }
    .loading-screen { /* loading styles */ }
  </style>
  <link rel="preload" href="/assets/index-*.css" as="style" onload="this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/assets/index-*.css"></noscript>
</head>
```

```javascript
// vite.config.ts - Add critical CSS extraction
import criticalPlugin from 'vite-plugin-critical';

export default defineConfig({
  plugins: [
    react(),
    criticalPlugin({
      criticalUrl: './',
      criticalBase: './dist/',
      criticalPages: [
        { uri: '/', template: 'index' },
      ],
    }),
  ],
});
```

**Validation:** FCP should improve by 100-150ms on mobile

---

### 4. GC Pauses During Scroll (MEDIUM PRIORITY)

**Impact:** 10-20% reduction in scroll jank  
**Risk:** Low  
**Location:** scroll-stress trace shows 34ms MajorGC

**Root Cause:** Object allocations during scroll animations trigger garbage collection.

**Trace Evidence:**
- `V8.GCFinalizeMC`: 34ms
- `V8.GC_MC_MARK`: 13ms
- Multiple incremental GC events

**Recommendation:**

```typescript
// src/components/dashboard/DashboardAvatar.tsx
// The component has many inline object creations in render

// BEFORE - creates new objects every render
<motion.div
  style={{
    perspective: 800,  // New object each render
    transformStyle: 'preserve-3d',
  }}
/>

// AFTER - stable references
const perspectiveStyle = useMemo(() => ({
  perspective: 800,
  transformStyle: 'preserve-3d' as const,
}), []);

<motion.div style={perspectiveStyle} />

// Also: Memoize springConfigs and gestureVariants at module level (already done)
// But ensure animation variants aren't recreated
```

```typescript
// Avoid inline animation config objects
// BEFORE
<motion.g
  animate={{
    opacity: [0.3, 0.9, 0.3],  // New array every render
  }}
/>

// AFTER - define outside component
const soundWaveAnimation = {
  opacity: [0.3, 0.9, 0.3],
};

<motion.g animate={soundWaveAnimation} />
```

**Validation:** Heap snapshot should show stable memory during scroll

---

### 5. DashboardAvatar Complexity (MEDIUM PRIORITY)

**Impact:** 20-30% reduction in component render time  
**Risk:** Medium (visual changes possible)  
**Location:** `src/components/dashboard/DashboardAvatar.tsx` (2000 lines)

**Root Cause:** Extremely complex SVG component with:
- 50+ motion.g/motion.path elements
- Multiple useEffect hooks with intervals
- Particle system with dynamic generation
- Complex idle fidget system
- Heavy filter effects

The component already has good optimizations (visibility observer, reduced motion support, mobile detection), but can be further improved.

**Recommendation:**

```typescript
// 1. Reduce particle count more aggressively on mobile
const count = isMobile 
  ? (isExcited ? 3 : 0)  // Was 6:3, now 3:0
  : (isExcited ? 8 : 4);  // Was 12:6, now 8:4

// 2. Disable all idle animations, not just on mobile
// Skip entirely if not visible
if (!isVisible) return null; // Early return before any hooks

// 3. Use CSS animations instead of framer-motion for simple effects
// Replace breathing animation with CSS
.breathing {
  animation: breathe 3.5s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { transform: scaleY(1) translateY(0); }
  50% { transform: scaleY(1.008) translateY(-0.3px); }
}

// 4. Consider splitting into sub-components for better memoization
const AvatarHead = memo(({ ... }) => ...);
const AvatarBody = memo(({ ... }) => ...);
const AvatarArms = memo(({ variant, ... }) => ...);
```

**Validation:** Profile Dashboard load - DashboardAvatar render time should decrease

---

### 6. Image Format Optimization (LOW PRIORITY)

**Impact:** ~27 KiB savings  
**Risk:** Very Low  
**Location:** ATTS logo images

**Current:** PNG format  
**Recommended:** WebP or AVIF with PNG fallback

```html
<picture>
  <source srcset="/assets/ATTS_Logo.webp" type="image/webp">
  <source srcset="/assets/ATTS_Logo.avif" type="image/avif">
  <img src="/assets/ATTS_Logo-removebg-preview.png" alt="ATTS Logo">
</picture>
```

**Validation:** Lighthouse modern-image-formats audit should pass

---

### 7. Unused CSS (LOW PRIORITY)

**Impact:** ~15 KiB savings  
**Risk:** Low  
**Location:** Tailwind CSS unused utilities

**Recommendation:**

```javascript
// tailwind.config.js - Ensure proper content paths
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // Consider enabling JIT mode if not already
  mode: 'jit',
};
```

```javascript
// vite.config.ts - Add PurgeCSS for production
import purgecss from '@fullhuman/postcss-purgecss';

// In postcss.config.js
plugins: [
  ...(process.env.NODE_ENV === 'production' ? [
    purgecss({
      content: ['./src/**/*.tsx', './index.html'],
      defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
    }),
  ] : []),
],
```

**Validation:** CSS bundle size should decrease by ~15-20%

---

### 8. Route Preloading (LOW PRIORITY)

**Impact:** Faster subsequent navigations  
**Risk:** Low  
**Location:** `src/App.tsx`

**Recommendation:**

```typescript
// Preload likely navigation targets on hover
import { useEffect } from 'react';

// Add route preloading utility
const preloadRoute = (routeImport: () => Promise<any>) => {
  routeImport(); // Start loading
};

// In NavCards or navigation components
<Link 
  to="/forms"
  onMouseEnter={() => preloadRoute(() => import('./pages/Forms'))}
>
  Forms
</Link>
```

**Validation:** Time-to-interactive on subsequent navigations should improve

---

### 9. beforeunload Handler Cost (LOW PRIORITY)

**Impact:** Minor cleanup improvement  
**Risk:** Very Low  
**Location:** Multiple components with cleanup

**Trace Evidence:** `beforeunload` events taking 30-74ms

**Root Cause:** Cleanup handlers doing synchronous work.

**Recommendation:**

```typescript
// src/contexts/AuthContext.tsx
// Current cleanup is already async, but ensure it doesn't block

const cleanupRealtime = async () => {
  // Use requestIdleCallback for non-critical cleanup
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // cleanup work
    });
  }
};
```

**Validation:** beforeunload handler time should decrease

---

### 10. Bundle Size Optimization (LOW PRIORITY)

**Impact:** Faster initial load  
**Risk:** Low  
**Location:** Build configuration

**Current Bundle Analysis:**
- `vendor-supabase`: 186 KB
- `vendor-react`: 174 KB  
- `vendor-motion`: 119 KB
- `ExpandableSection`: 59 KB
- `JobDetailExpanded`: 53 KB

**Recommendation:**

```typescript
// vite.config.ts - More aggressive code splitting
rollupOptions: {
  output: {
    manualChunks: (id) => {
      // Split three.js separately (if used)
      if (id.includes('three') || id.includes('@react-three')) {
        return 'vendor-three';
      }
      // Split date-fns by locale
      if (id.includes('date-fns/locale')) {
        return 'vendor-date-locale';
      }
      // Keep existing chunks...
    },
  },
},
```

**Validation:** Run `npm run bundle:check` - no chunks should exceed 200KB

---

## Prioritized Fix List

| Priority | Fix | Impact | Risk | Effort |
|----------|-----|--------|------|--------|
| 1 | Unused JavaScript removal | High | Medium | Medium |
| 2 | Break up long main-thread tasks | High | Low | Low |
| 3 | Render-blocking CSS | Medium | Low | Medium |
| 4 | GC pause reduction | Medium | Low | Low |
| 5 | DashboardAvatar simplification | Medium | Medium | High |
| 6 | Image format optimization | Low | Very Low | Low |
| 7 | Unused CSS removal | Low | Low | Low |
| 8 | Route preloading | Low | Low | Low |
| 9 | beforeunload optimization | Very Low | Very Low | Low |
| 10 | Bundle size optimization | Low | Low | Medium |

---

## Artifacts

All profiling artifacts are stored in `/performance-report/artifacts/`:

```
performance-report/
├── artifacts/
│   ├── traces/
│   │   ├── home-load.trace.json
│   │   ├── dashboard.trace.json
│   │   ├── forms.trace.json
│   │   ├── announcements.trace.json
│   │   ├── admin-users.trace.json
│   │   ├── admin-rto.trace.json
│   │   ├── mechanic-dvir-center.trace.json
│   │   ├── dvir-form.trace.json
│   │   ├── navigation-stress.trace.json
│   │   └── scroll-stress.trace.json
│   ├── cpu-profiles/
│   │   ├── home-load.cpuprofile
│   │   ├── dashboard.cpuprofile
│   │   └── ... (10 profiles)
│   ├── heap-snapshots/
│   │   └── dashboard.heapsnapshot
│   └── lighthouse/
│       ├── lh-mobile.json
│       ├── lh-desktop.json
│       └── lh-dashboard.json
├── analysis-results.json
├── profiling-results.json
└── HOTSPOT_REPORT.md
```

---

## Validation Steps

After applying fixes:

1. **Re-run profiling:**
   ```bash
   npm run build
   ./node_modules/.bin/vite preview --port 4173 &
   node scripts/performance-profiling.mjs --skip-login
   node scripts/analyze-traces.mjs
   ```

2. **Check Lighthouse scores:**
   - Performance should remain >90
   - FCP should improve to <1.8s on mobile
   - LCP should improve to <2.5s on mobile

3. **Verify no regressions:**
   - Test all user flows manually
   - Ensure animations remain smooth
   - Verify accessibility scores maintained at 100

---

## Conclusion

The ATTS Employee Portal is already well-optimized with excellent accessibility and performance scores. The recommended fixes focus on incremental improvements that will:

1. **Reduce initial load time** by eliminating unused code
2. **Improve interactivity** by breaking up long tasks
3. **Enhance scroll smoothness** by reducing GC pressure
4. **Maintain visual quality** while reducing complexity

The highest-impact fixes (unused JavaScript, long tasks) should be prioritized as they offer the best return on investment with minimal risk.

