/**
 * useAnnouncementTracking Hook
 *
 * Tracks announcement views using IntersectionObserver.
 * Implements per-session deduplication to avoid counting the same
 * announcement multiple times in a single session.
 *
 * @module useAnnouncementTracking
 * @see docs/Telemetry_plan.md for full documentation
 */

import { useCallback, useEffect, useRef } from 'react';
import { trackAnnouncementViewed, type AnnouncementViewedProps } from '../lib/telemetry';
import { CONFIG } from '../lib/config';

// Per-session deduplication set
const viewedInSession = new Set<string>();

/**
 * Source of the announcement view
 */
export type AnnouncementSource = 'dashboard' | 'announcements_page' | 'notification' | 'featured_section';

/**
 * Options for the useAnnouncementTracking hook
 */
interface UseAnnouncementTrackingOptions {
  /** Source of the announcement view */
  source: AnnouncementSource;
  /** Intersection threshold (0-1). Default: 0.5 (50% visible) */
  threshold?: number;
  /** Minimum time visible before tracking (ms). Default: 1000 */
  minVisibleTime?: number;
}

/**
 * Hook to track when an announcement becomes visible.
 *
 * Uses IntersectionObserver to detect when the announcement card
 * enters the viewport and has been visible for a minimum time.
 *
 * @param announcementId - The announcement ID to track
 * @param isAiGenerated - Whether the announcement was AI-generated
 * @param options - Tracking options
 * @returns ref to attach to the announcement element
 *
 * @example
 * ```tsx
 * function AnnouncementCard({ announcement }) {
 *   const trackingRef = useAnnouncementTracking(
 *     announcement.id,
 *     announcement.author === 'Safety AI',
 *     { source: 'announcements_page' }
 *   );
 *
 *   return <div ref={trackingRef}>...</div>;
 * }
 * ```
 */
export function useAnnouncementTracking(
  announcementId: string,
  isAiGenerated: boolean,
  options: UseAnnouncementTrackingOptions
): React.RefCallback<HTMLElement> {
  const { source, threshold = 0.5, minVisibleTime = 1000 } = options;

  // Track visibility timer
  const visibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (visibleTimerRef.current) {
      clearTimeout(visibleTimerRef.current);
      visibleTimerRef.current = null;
    }
    if (observerRef.current && elementRef.current) {
      observerRef.current.unobserve(elementRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Ref callback to attach observer
  const setRef = useCallback(
    (element: HTMLElement | null) => {
      // Cleanup previous observer
      cleanup();

      if (!element) {
        elementRef.current = null;
        return;
      }

      elementRef.current = element;

      // Skip if telemetry is disabled
      if (!CONFIG.telemetry?.enabled) {
        return;
      }

      // Skip if already viewed in this session
      if (viewedInSession.has(announcementId)) {
        return;
      }

      // Create IntersectionObserver
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];

          if (entry.isIntersecting) {
            // Start timer when element becomes visible
            if (!visibleTimerRef.current) {
              visibleTimerRef.current = setTimeout(() => {
                // Double-check it hasn't been viewed yet (race condition)
                if (viewedInSession.has(announcementId)) {
                  return;
                }

                // Mark as viewed
                viewedInSession.add(announcementId);

                // Track the view
                const props: AnnouncementViewedProps = {
                  announcement_id: announcementId,
                  is_ai_generated: isAiGenerated,
                  source,
                };

                trackAnnouncementViewed(props);
              }, minVisibleTime);
            }
          } else {
            // Cancel timer if element leaves viewport before minVisibleTime
            if (visibleTimerRef.current) {
              clearTimeout(visibleTimerRef.current);
              visibleTimerRef.current = null;
            }
          }
        },
        { threshold }
      );

      observerRef.current.observe(element);
    },
    [announcementId, isAiGenerated, source, threshold, minVisibleTime, cleanup]
  );

  return setRef;
}

/**
 * Clear the per-session viewed set.
 *
 * Call this when the user logs out or when you want to reset tracking.
 */
export function clearViewedAnnouncements(): void {
  viewedInSession.clear();
}

/**
 * Check if an announcement has been viewed in this session.
 *
 * @param announcementId - The announcement ID to check
 * @returns true if viewed, false otherwise
 */
export function hasViewedAnnouncement(announcementId: string): boolean {
  return viewedInSession.has(announcementId);
}

export default useAnnouncementTracking;
