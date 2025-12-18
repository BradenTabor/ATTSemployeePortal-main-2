/**
 * Mobile Performance Utilities
 * 
 * Optimized for iOS Safari/WebKit and Android Chrome
 * Provides instrumentation, debouncing, visibility detection, and device capability detection
 */

// ============================================================================
// DEVICE CAPABILITY DETECTION
// ============================================================================

interface DeviceCapabilities {
  /** True if device appears to be low-end (limited CPU/memory) */
  isLowEnd: boolean;
  /** True on mobile viewport */
  isMobile: boolean;
  /** True if user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** True if device is in low-power/battery-saver mode (when detectable) */
  isLowPowerMode: boolean;
  /** Number of logical CPU cores (used for thread budget estimation) */
  hardwareConcurrency: number;
  /** Approximate device memory in GB (when available) */
  deviceMemory: number;
  /** True if connection is slow (2g/3g or save-data enabled) */
  isSlowConnection: boolean;
}

// Extend Navigator for non-standard APIs
declare global {
  interface Navigator {
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      saveData?: boolean;
    };
  }
}

let cachedCapabilities: DeviceCapabilities | null = null;

export function getDeviceCapabilities(): DeviceCapabilities {
  if (cachedCapabilities) return cachedCapabilities;
  if (typeof window === 'undefined') {
    return {
      isLowEnd: false,
      isMobile: false,
      prefersReducedMotion: false,
      isLowPowerMode: false,
      hardwareConcurrency: 4,
      deviceMemory: 4,
      isSlowConnection: false,
    };
  }

  const nav = navigator;
  const hardwareConcurrency = nav.hardwareConcurrency || 4;
  const deviceMemory = nav.deviceMemory || 4;
  const isMobile = window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(nav.userAgent);
  
  // Reduced motion preference
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  
  // Slow connection detection
  const connection = nav.connection;
  const isSlowConnection = !!(
    connection?.saveData ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === 'slow-2g'
  );
  
  // Low-end device heuristics:
  // - Less than 4GB RAM
  // - Less than 4 cores
  // - Slow connection
  const isLowEnd = deviceMemory < 4 || hardwareConcurrency < 4 || isSlowConnection;
  
  // Low power mode detection is limited; we approximate via reduced motion + battery API
  // Most browsers don't expose this reliably
  const isLowPowerMode = prefersReducedMotion;

  cachedCapabilities = {
    isLowEnd,
    isMobile,
    prefersReducedMotion,
    isLowPowerMode,
    hardwareConcurrency,
    deviceMemory,
    isSlowConnection,
  };

  return cachedCapabilities;
}

// Reset cache on resize (viewport changes)
if (typeof window !== 'undefined') {
  let resizeTimeout: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      cachedCapabilities = null;
    }, 500);
  });
}

// ============================================================================
// PERFORMANCE INSTRUMENTATION (DEV-ONLY)
// ============================================================================

const IS_DEV = import.meta.env.DEV;
const PERF_ENABLED = IS_DEV && typeof performance !== 'undefined';

/**
 * Mark the start of a performance measurement
 */
export function perfMark(name: string): void {
  if (!PERF_ENABLED) return;
  try {
    performance.mark(`${name}-start`);
  } catch {
    // Safari may throw in some contexts
  }
}

/**
 * Mark the end of a performance measurement and log duration
 */
export function perfMeasure(name: string): void {
  if (!PERF_ENABLED) return;
  try {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const entries = performance.getEntriesByName(name, 'measure');
    const entry = entries[entries.length - 1];
    if (entry && entry.duration > 16) {
      console.warn(`[PERF] ${name}: ${entry.duration.toFixed(2)}ms (exceeds 16ms frame budget)`);
    } else if (entry) {
      console.debug(`[PERF] ${name}: ${entry.duration.toFixed(2)}ms`);
    }
    
    // Cleanup
    performance.clearMarks(`${name}-start`);
    performance.clearMarks(`${name}-end`);
    performance.clearMeasures(name);
  } catch {
    // Ignore measurement errors
  }
}

/**
 * Initialize long task observer (dev-only)
 * Logs tasks that block main thread for >50ms
 */
export function initLongTaskObserver(): (() => void) | null {
  if (!PERF_ENABLED || typeof PerformanceObserver === 'undefined') return null;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.warn(`[LONG TASK] Duration: ${entry.duration.toFixed(2)}ms`, entry);
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
    return () => observer.disconnect();
  } catch {
    // longtask not supported
    return null;
  }
}

// ============================================================================
// DEBOUNCE & THROTTLE UTILITIES
// ============================================================================

/**
 * Creates a debounced version of a function
 * Uses requestIdleCallback when available for better frame budget management
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
  options?: { leading?: boolean; maxWait?: number }
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;
  let lastArgs: Parameters<T> | null = null;
  const maxWait = options?.maxWait;
  const leading = options?.leading ?? false;

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
      lastCallTime = Date.now();
    }
  };

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // Leading edge
    if (leading && !timeoutId) {
      invoke();
    }

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Max wait enforcement
    if (maxWait && timeSinceLastCall >= maxWait) {
      invoke();
      return;
    }

    // Schedule trailing edge
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!leading || lastArgs) {
        invoke();
      }
    }, delay);
  }) as T & { cancel: () => void; flush: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    invoke();
  };

  return debounced;
}

/**
 * Creates a throttled version of a function using requestAnimationFrame
 * Ideal for scroll/resize handlers
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T
): T & { cancel: () => void } {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs);
        }
        rafId = null;
      });
    }
  }) as T & { cancel: () => void };

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
}

// ============================================================================
// VISIBILITY & FOCUS MANAGEMENT
// ============================================================================

type VisibilityCallback = (isVisible: boolean) => void;
const visibilityListeners = new Set<VisibilityCallback>();

/**
 * Subscribe to document visibility changes
 * Returns unsubscribe function
 */
export function onVisibilityChange(callback: VisibilityCallback): () => void {
  visibilityListeners.add(callback);

  // Initialize listener if this is the first subscriber
  if (visibilityListeners.size === 1 && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // Call immediately with current state
  if (typeof document !== 'undefined') {
    callback(document.visibilityState === 'visible');
  }

  return () => {
    visibilityListeners.delete(callback);
    if (visibilityListeners.size === 0 && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
}

function handleVisibilityChange(): void {
  const isVisible = document.visibilityState === 'visible';
  visibilityListeners.forEach((cb) => cb(isVisible));
}

/**
 * Get current visibility state
 */
export function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

// ============================================================================
// PROGRESSIVE RENDERING UTILITIES
// ============================================================================

/**
 * Schedule work during idle time (with timeout fallback)
 * Returns a cancel function
 */
export function scheduleIdleWork(
  callback: () => void,
  options?: { timeout?: number }
): () => void {
  const timeout = options?.timeout ?? 100;

  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(callback, { timeout });
    return () => cancelIdleCallback(id);
  } else {
    // Fallback for Safari (no requestIdleCallback support)
    const id = setTimeout(callback, Math.min(timeout, 16));
    return () => clearTimeout(id);
  }
}

/**
 * Create a progressive renderer for lists
 * Renders items in batches to avoid blocking main thread
 */
export function createProgressiveRenderer<T>(
  items: T[],
  options?: {
    initialBatch?: number;
    batchSize?: number;
    batchDelay?: number;
  }
): {
  visibleItems: T[];
  isComplete: boolean;
  renderMore: () => void;
  reset: () => void;
} {
  const initialBatch = options?.initialBatch ?? 5;
  const batchSize = options?.batchSize ?? 5;
  
  let visibleCount = Math.min(initialBatch, items.length);

  return {
    get visibleItems() {
      return items.slice(0, visibleCount);
    },
    get isComplete() {
      return visibleCount >= items.length;
    },
    renderMore() {
      visibleCount = Math.min(visibleCount + batchSize, items.length);
    },
    reset() {
      visibleCount = Math.min(initialBatch, items.length);
    },
  };
}

// ============================================================================
// INTERSECTION OBSERVER UTILITIES
// ============================================================================

/**
 * Create an intersection observer for lazy loading
 * Returns cleanup function
 */
export function observeIntersection(
  element: Element,
  callback: (isIntersecting: boolean) => void,
  options?: IntersectionObserverInit
): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    // Fallback: assume visible
    callback(true);
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        callback(entry.isIntersecting);
      });
    },
    {
      rootMargin: '100px',
      threshold: 0,
      ...options,
    }
  );

  observer.observe(element);
  return () => observer.disconnect();
}

// ============================================================================
// CSS PERFORMANCE UTILITIES
// ============================================================================

/**
 * Apply will-change before animation, remove after
 * Prevents will-change abuse which wastes GPU memory
 */
export function withWillChange(
  element: HTMLElement | null,
  properties: string,
  duration: number = 300
): void {
  if (!element) return;

  element.style.willChange = properties;
  
  setTimeout(() => {
    element.style.willChange = 'auto';
  }, duration + 50); // Small buffer after animation completes
}

/**
 * Check if CSS contain is safe to use (some Safari versions have issues)
 */
export function supportsContain(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return false;
  }
  return CSS.supports('contain', 'layout');
}

// ============================================================================
// ADAPTIVE QUALITY SETTINGS
// ============================================================================

export interface QualitySettings {
  /** Enable expensive visual effects (blur, filters, shadows) */
  enableEffects: boolean;
  /** Enable animations */
  enableAnimations: boolean;
  /** Enable complex SVG rendering */
  enableComplexSVG: boolean;
  /** Maximum items to render before virtualizing */
  virtualizationThreshold: number;
  /** Debounce delay for realtime updates */
  realtimeDebounceMs: number;
}

/**
 * Get quality settings based on device capabilities
 */
export function getQualitySettings(): QualitySettings {
  const caps = getDeviceCapabilities();

  if (caps.prefersReducedMotion) {
    return {
      enableEffects: false,
      enableAnimations: false,
      enableComplexSVG: false,
      virtualizationThreshold: 10,
      realtimeDebounceMs: 500,
    };
  }

  if (caps.isLowEnd) {
    return {
      enableEffects: false,
      enableAnimations: true,
      enableComplexSVG: false,
      virtualizationThreshold: 10,
      realtimeDebounceMs: 500,
    };
  }

  if (caps.isMobile) {
    return {
      enableEffects: true,
      enableAnimations: true,
      enableComplexSVG: true,
      virtualizationThreshold: 15,
      realtimeDebounceMs: 300,
    };
  }

  // Desktop
  return {
    enableEffects: true,
    enableAnimations: true,
    enableComplexSVG: true,
    virtualizationThreshold: 30,
    realtimeDebounceMs: 200,
  };
}
