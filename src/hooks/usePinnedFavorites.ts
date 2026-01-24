/**
 * usePinnedFavorites Hook
 * 
 * Custom hook for managing pinned/favorited navigation items.
 * Handles localStorage persistence and cross-component synchronization.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPersistedJson, setPersistedJsonImmediate } from '../lib/persistence';

export const PINNED_STORAGE_KEY = 'dashboard-pinned-favorites';
export const MAX_PINNED = 4;
const STORAGE_KEY = PINNED_STORAGE_KEY;

// Custom event name for syncing pinned state across components
const PINNED_CHANGE_EVENT = 'pinned-favorites-changed';

// Type for the custom event detail
interface PinnedChangeEventDetail {
  pinned: string[];
}

export function usePinnedFavorites() {
  const [pinned, setPinned] = useState<string[]>(() => {
    // Initialize from localStorage immediately
    const stored = getPersistedJson<string[]>(STORAGE_KEY);
    return stored && Array.isArray(stored) ? stored : [];
  });
  
  // Listen for changes from other components using this hook
  useEffect(() => {
    const handlePinnedChange = (e: Event) => {
      // Get pinned array directly from event detail (instant, no localStorage read)
      const customEvent = e as CustomEvent<PinnedChangeEventDetail>;
      if (customEvent.detail?.pinned && Array.isArray(customEvent.detail.pinned)) {
        setPinned(customEvent.detail.pinned);
      }
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      // Cross-tab sync - must read from localStorage
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const stored = JSON.parse(e.newValue);
          if (Array.isArray(stored)) {
            setPinned(stored);
          }
        } catch {
          // Invalid JSON - ignore
        }
      }
    };
    
    // Listen for custom event (same-tab sync - instant via event detail)
    window.addEventListener(PINNED_CHANGE_EVENT, handlePinnedChange);
    // Also listen for storage event (cross-tab sync)
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener(PINNED_CHANGE_EVENT, handlePinnedChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Toggle pin status
  const togglePin = useCallback((itemId: string) => {
    setPinned(prev => {
      const newPinned = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : prev.length < MAX_PINNED
          ? [...prev, itemId]
          : prev;
      
      // Write to localStorage immediately (no debounce for instant UI feedback)
      setPersistedJsonImmediate(STORAGE_KEY, newPinned);
      // Dispatch custom event with new state directly (no localStorage read needed)
      window.dispatchEvent(new CustomEvent<PinnedChangeEventDetail>(PINNED_CHANGE_EVENT, {
        detail: { pinned: newPinned }
      }));
      return newPinned;
    });
  }, []);
  
  // Check if item is pinned
  const isPinned = useCallback((itemId: string) => {
    return pinned.includes(itemId);
  }, [pinned]);
  
  // Check if can pin more
  const canPinMore = pinned.length < MAX_PINNED;
  
  return { pinned, togglePin, isPinned, canPinMore };
}
