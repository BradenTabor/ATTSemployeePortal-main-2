# Performance Optimization Guide

This document describes the performance utilities and optimizations added to the ATTS Employee Portal.

## Overview

The performance optimization package includes:

1. **Utility Functions** (`src/utils/performance.ts`) - Debounce, throttle, RAF throttle, lazy loading
2. **Initialization Module** (`src/init/perf-init.ts`) - Automatic setup on app load
3. **Web Worker Template** (`src/workers/heavyWorker.ts`) - Offload CPU-intensive tasks

## Quick Start

The performance initializer is automatically imported in `src/main.tsx`. No additional setup required for basic functionality.

## Utility Functions

### `debounce(fn, wait)`

Delays function execution until after the specified wait time has elapsed since the last call.

```typescript
import { debounce } from '@/utils/performance';

const debouncedSearch = debounce((query: string) => {
  // API call
}, 300);

input.addEventListener('input', (e) => debouncedSearch(e.target.value));
```

### `throttle(fn, limit)`

Ensures function is called at most once per specified interval.

```typescript
import { throttle } from '@/utils/performance';

const throttledScroll = throttle(() => {
  // Handle scroll
}, 100);

window.addEventListener('scroll', throttledScroll);
```

### `rafThrottle(fn)`

Throttles using `requestAnimationFrame`. Ideal for animations and visual updates.

```typescript
import { rafThrottle } from '@/utils/performance';

const handleMouseMove = rafThrottle((e: MouseEvent) => {
  // Update position
});

element.addEventListener('mousemove', handleMouseMove);
```

### `lazyLoadImages(options)`

Sets up intersection observer-based lazy loading for images with `data-src` attribute.

```html
<!-- In your HTML/JSX -->
<img data-src="/path/to/image.jpg" alt="Description" />
```

```typescript
import { lazyLoadImages } from '@/utils/performance';

// Manual initialization (automatic via perf-init)
const cleanup = lazyLoadImages({
  rootMargin: '200px',
  threshold: 0.1,
  loadedClass: 'loaded',
});

// Call cleanup when done
cleanup();
```

### `runWhenIdle(callback, options)`

Runs callback during browser idle time using `requestIdleCallback` with fallback.

```typescript
import { runWhenIdle } from '@/utils/performance';

const cancel = runWhenIdle(() => {
  // Non-critical task
}, { timeout: 2000 });
```

### `measurePerformance(fn, label)`

Wraps a function to log its execution time (dev mode only).

```typescript
import { measurePerformance } from '@/utils/performance';

const measuredFn = measurePerformance(expensiveOperation, 'ExpensiveOp');
measuredFn(); // Logs: [Perf] ExpensiveOp: 42.50ms
```

## Web Worker Usage

For CPU-intensive operations, use the worker template:

```typescript
// Create worker instance
const worker = new Worker(
  new URL('./workers/heavyWorker.ts', import.meta.url),
  { type: 'module' }
);

// Send work to worker
worker.postMessage({
  type: 'COMPUTE_STATS',
  payload: [1, 2, 3, 4, 5, ...largeNumberArray],
  id: 'stats-1'
});

// Handle results
worker.onmessage = (event) => {
  if (event.data.type === 'SUCCESS') {
    console.log('Stats:', event.data.result);
  }
};

// Cleanup when done
worker.terminate();
```

### Available Worker Operations

| Type | Payload | Description |
|------|---------|-------------|
| `PROCESS_DATA` | `unknown[]` | Process array items |
| `SORT_LARGE_ARRAY` | `unknown[]` | Sort large arrays |
| `COMPUTE_STATS` | `number[]` | Calculate statistics |
| `PARSE_JSON` | `string` | Parse large JSON strings |

## Performance Metrics

The initializer automatically reports Web Vitals in development:

- **LCP** (Largest Contentful Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)

## CSS for Lazy-Loaded Images

Add these styles for smooth lazy loading transitions:

```css
img[data-src] {
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}

img.lazy-loaded,
img.fade-in {
  opacity: 1;
}

img.lazy-error {
  /* Fallback styling for failed images */
  background: #f0f0f0;
}
```

## Best Practices

1. **Use debounce for user input** - Search, resize, typing
2. **Use throttle for continuous events** - Scroll, mouse movement
3. **Use rafThrottle for visual updates** - Animations, position updates
4. **Lazy load images below the fold** - Add `data-src` instead of `src`
5. **Offload heavy computations** - Use Web Workers for sorting, filtering large datasets
6. **Measure before optimizing** - Use `measurePerformance` to identify bottlenecks

## Monitoring

Run Lighthouse audits regularly:

```bash
npm run lighthouse
```

Check bundle sizes:

```bash
npm run build  # Includes bundle:check
```

## Files

| File | Purpose |
|------|---------|
| `src/utils/performance.ts` | Core utility functions |
| `src/init/perf-init.ts` | Auto-initialization on app load |
| `src/workers/heavyWorker.ts` | Web Worker template |
| `lighthouserc.cjs` | Lighthouse CI configuration |
| `scripts/checkBundleSize.mjs` | Bundle size guardrails |

