/**
 * Performance Utilities
 * 
 * A collection of utility functions for improving application performance
 * through debouncing, throttling, and lazy loading strategies.
 */

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * 
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Throttle function - ensures the function is called at most once per specified interval.
 * 
 * @param fn - The function to throttle
 * @param limit - The minimum interval between function calls in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs !== null) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * RAF Throttle - throttles function calls using requestAnimationFrame.
 * Ideal for scroll, resize, and animation-related event handlers.
 * 
 * @param fn - The function to throttle
 * @returns A RAF-throttled version of the function
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  fn: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs !== null) {
          fn.apply(this, lastArgs);
        }
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

/**
 * Options for lazy loading images
 */
export interface LazyLoadOptions {
  /** Root element for intersection observer (default: null/viewport) */
  root?: Element | null;
  /** Margin around root element (default: '100px') */
  rootMargin?: string;
  /** Intersection threshold (default: 0.1) */
  threshold?: number;
  /** Attribute containing the lazy source (default: 'data-src') */
  srcAttribute?: string;
  /** Attribute for lazy srcset (default: 'data-srcset') */
  srcsetAttribute?: string;
  /** Class to add when image is loaded (default: 'loaded') */
  loadedClass?: string;
  /** Callback when image loads */
  onLoad?: (img: HTMLImageElement) => void;
  /** Callback when image fails to load */
  onError?: (img: HTMLImageElement, error: Event) => void;
}

/**
 * Lazy load images using Intersection Observer.
 * Finds all images with data-src attribute and loads them when they enter the viewport.
 * 
 * @param options - Configuration options for lazy loading
 * @returns Cleanup function to disconnect the observer
 */
export function lazyLoadImages(options: LazyLoadOptions = {}): () => void {
  const {
    root = null,
    rootMargin = '100px',
    threshold = 0.1,
    srcAttribute = 'data-src',
    srcsetAttribute = 'data-srcset',
    loadedClass = 'loaded',
    onLoad,
    onError,
  } = options;

  // Check for Intersection Observer support
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all images immediately
    const images = document.querySelectorAll<HTMLImageElement>(`img[${srcAttribute}]`);
    images.forEach((img) => {
      const src = img.getAttribute(srcAttribute);
      const srcset = img.getAttribute(srcsetAttribute);
      if (src) {
        img.src = src;
        img.removeAttribute(srcAttribute);
      }
      if (srcset) {
        img.srcset = srcset;
        img.removeAttribute(srcsetAttribute);
      }
    });
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.getAttribute(srcAttribute);
          const srcset = img.getAttribute(srcsetAttribute);

          if (src) {
            img.addEventListener(
              'load',
              () => {
                img.classList.add(loadedClass);
                onLoad?.(img);
              },
              { once: true }
            );

            img.addEventListener(
              'error',
              (e) => {
                onError?.(img, e);
              },
              { once: true }
            );

            img.src = src;
            img.removeAttribute(srcAttribute);
          }

          if (srcset) {
            img.srcset = srcset;
            img.removeAttribute(srcsetAttribute);
          }

          observer.unobserve(img);
        }
      });
    },
    { root, rootMargin, threshold }
  );

  // Observe all images with data-src
  const images = document.querySelectorAll<HTMLImageElement>(`img[${srcAttribute}]`);
  images.forEach((img) => observer.observe(img));

  // Return cleanup function
  return () => observer.disconnect();
}

/**
 * Measure the execution time of a function.
 * 
 * @param fn - The function to measure
 * @param label - Label for the performance measurement
 * @returns The wrapped function that logs performance
 */
export function measurePerformance<T extends (...args: unknown[]) => unknown>(
  fn: T,
  label: string
): (...args: Parameters<T>) => ReturnType<T> {
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const start = performance.now();
    const result = fn.apply(this, args) as ReturnType<T>;
    const end = performance.now();
    
    if (import.meta.env.DEV) {
      console.log(`[Perf] ${label}: ${(end - start).toFixed(2)}ms`);
    }
    
    return result;
  };
}

/**
 * Idle callback wrapper with fallback for browsers without requestIdleCallback
 * 
 * @param callback - The callback to run when idle
 * @param options - Options including timeout
 * @returns Cancel function
 */
export function runWhenIdle(
  callback: () => void,
  options: { timeout?: number } = {}
): () => void {
  const { timeout = 1000 } = options;

  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(callback, { timeout });
    return () => cancelIdleCallback(id);
  } else {
    const id = setTimeout(callback, 1);
    return () => clearTimeout(id);
  }
}

