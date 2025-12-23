import { useEffect, useRef, useCallback } from 'react';
import { subscribeToTableChanges, TableSubscriptionOptions } from '../lib/realtime';
import { onVisibilityChange, isDocumentVisible } from '../lib/mobilePerf';
import { logger } from '../lib/logger';

/**
 * useVisibleSubscription - Realtime subscription that pauses when tab is hidden
 * 
 * Mobile optimization: Automatically pauses Supabase Realtime subscriptions when
 * the document is not visible (tab is hidden or user navigated away). This saves:
 * - Battery life on mobile devices
 * - Network bandwidth on slow/expensive connections
 * - Server resources by reducing active WebSocket connections
 * 
 * When the tab becomes visible again, the subscription is automatically re-established.
 * 
 * @example
 * ```typescript
 * useVisibleSubscription({
 *   channelName: "jobs-updates",
 *   table: "jobs",
 *   onInsert: (payload) => refetch(),
 *   onUpdate: (payload) => refetch(),
 * });
 * ```
 */
export function useVisibleSubscription<
  Row extends Record<string, unknown> = Record<string, unknown>
>(options: TableSubscriptionOptions<Row>): void {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const optionsRef = useRef(options);
  
  // Keep options ref updated to avoid stale closures
  useEffect(() => {
    optionsRef.current = options;
  });
  
  // Subscribe to realtime changes
  const subscribe = useCallback(() => {
    // Don't subscribe if already subscribed
    if (unsubscribeRef.current) return;
    
    logger.debug(`[useVisibleSubscription] Subscribing to ${optionsRef.current.channelName}`);
    unsubscribeRef.current = subscribeToTableChanges(optionsRef.current);
  }, []);
  
  // Unsubscribe from realtime changes
  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      logger.debug(`[useVisibleSubscription] Unsubscribing from ${optionsRef.current.channelName}`);
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    // Initial subscription if document is visible
    if (isDocumentVisible()) {
      subscribe();
    }
    
    // Handle visibility changes
    const unsubscribeVisibility = onVisibilityChange((visible) => {
      if (visible) {
        // Tab became visible - resubscribe
        subscribe();
      } else {
        // Tab became hidden - unsubscribe to save resources
        unsubscribe();
      }
    });
    
    // Cleanup on unmount
    return () => {
      unsubscribeVisibility();
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);
}

/**
 * useVisibleSubscriptionWithRefetch - Convenience hook that automatically refetches
 * data when the subscription receives an update
 * 
 * @param options - Subscription options
 * @param refetch - Function to call when data changes (e.g., from useQuery)
 */
export function useVisibleSubscriptionWithRefetch<
  Row extends Record<string, unknown> = Record<string, unknown>
>(
  options: Omit<TableSubscriptionOptions<Row>, 'onInsert' | 'onUpdate' | 'onDelete'>,
  refetch: () => void
): void {
  useVisibleSubscription({
    ...options,
    onInsert: () => refetch(),
    onUpdate: () => refetch(),
    onDelete: () => refetch(),
  });
}

export default useVisibleSubscription;

