/**
 * Performance Initializer
 * 
 * This module runs at application startup to initialize performance optimizations.
 * Import this module early in your application entry point to enable:
 * - Lazy loading of images with data-src attribute
 * - Performance monitoring hooks
 * - Resource hints and preloading optimizations
 */

import { lazyLoadImages, runWhenIdle } from '../utils/performance';

// Store cleanup functions for teardown
let cleanupFunctions: (() => void)[] = [];

/**
 * Initialize all performance optimizations
 */
function initializePerformanceOptimizations(): void {
  // Initialize lazy loading for images
  const cleanupLazyLoad = lazyLoadImages({
    rootMargin: '200px', // Start loading 200px before viewport
    threshold: 0.01,
    loadedClass: 'lazy-loaded',
    onLoad: (img) => {
      // Add fade-in animation class if desired
      img.classList.add('fade-in');
    },
    onError: (img) => {
      // Handle failed image loads gracefully
      img.classList.add('lazy-error');
      console.warn('[PerfInit] Failed to load image:', img.getAttribute('alt') || img.src);
    },
  });

  cleanupFunctions.push(cleanupLazyLoad);

  // Set up MutationObserver to handle dynamically added images
  const observer = new MutationObserver((mutations) => {
    let hasNewImages = false;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.tagName === 'IMG' && node.hasAttribute('data-src')) {
            hasNewImages = true;
          } else if (node.querySelectorAll) {
            const images = node.querySelectorAll('img[data-src]');
            if (images.length > 0) {
              hasNewImages = true;
            }
          }
        }
      });
    });

    // Re-initialize lazy loading if new images were added
    if (hasNewImages) {
      runWhenIdle(() => {
        lazyLoadImages({
          rootMargin: '200px',
          threshold: 0.01,
        });
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  cleanupFunctions.push(() => observer.disconnect());

  // Log performance initialization in development
  if (import.meta.env.DEV) {
    console.log('[PerfInit] Performance optimizations initialized');
  }
}

/**
 * Report Web Vitals metrics (if available)
 */
function reportWebVitals(): void {
  if ('PerformanceObserver' in window) {
    try {
      // Observe Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (import.meta.env.DEV) {
          console.log('[WebVitals] LCP:', lastEntry.startTime.toFixed(2), 'ms');
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      cleanupFunctions.push(() => lcpObserver.disconnect());

      // Observe First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[];
        entries.forEach((entry) => {
          if (import.meta.env.DEV) {
            console.log('[WebVitals] FID:', entry.processingStart - entry.startTime, 'ms');
          }
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      cleanupFunctions.push(() => fidObserver.disconnect());

      // Observe Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[];
        entries.forEach((entry) => {
          if (!entry.hadRecentInput && entry.value) {
            clsValue += entry.value;
          }
        });
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      cleanupFunctions.push(() => {
        clsObserver.disconnect();
        if (import.meta.env.DEV) {
          console.log('[WebVitals] CLS:', clsValue.toFixed(4));
        }
      });
    } catch {
      // PerformanceObserver types may not be available in all browsers
    }
  }
}

/**
 * Cleanup all performance optimizations
 */
export function cleanupPerformanceOptimizations(): void {
  cleanupFunctions.forEach((cleanup) => cleanup());
  cleanupFunctions = [];
}

// Initialize on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializePerformanceOptimizations();
      reportWebVitals();
    });
  } else {
    // DOM already loaded, initialize immediately
    initializePerformanceOptimizations();
    reportWebVitals();
  }
}

// Export for manual initialization if needed
export { initializePerformanceOptimizations, reportWebVitals };

