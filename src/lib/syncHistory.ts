/**
 * Sync History Store
 *
 * Zustand store that tracks recently synced offline submissions.
 * Provides the data for post-sync confirmation UI across the app:
 * - Per-item success toasts
 * - Sync summary notifications
 * - "Recently Synced" dashboard section
 * - Banner confirmation badge
 *
 * Items auto-expire after 1 hour (they're confirmations, not records).
 *
 * @module syncHistory
 */

import { create } from 'zustand';
import type { FormType } from './offlineQueue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncedItem {
  /** Unique ID (matches original queue entry ID). */
  id: string;
  /** Form type that was synced. */
  formType: FormType;
  /** Whether the submission included photos. */
  hadPhotos: boolean;
  /** Number of photos synced. */
  photoCount: number;
  /** When this item was successfully synced. */
  syncedAt: number;
  /** Date the form was "for" (e.g. DVIR date, JSA job_date). */
  dateFor?: string;
  /** Whether the user has acknowledged/seen this item. */
  acknowledged: boolean;
}

export interface SyncCycleSummary {
  /** Unique ID for this sync cycle. */
  id: string;
  /** When the sync cycle completed. */
  completedAt: number;
  /** Number of items successfully synced. */
  processed: number;
  /** Number that failed. */
  failed: number;
  /** Number discarded due to conflicts. */
  discarded: number;
  /** Whether the user has seen this summary. */
  acknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long to keep synced items in history (1 hour). */
const ITEM_TTL_MS = 60 * 60 * 1000;

/** Max items to keep in history (prevent memory bloat). */
const MAX_HISTORY_ITEMS = 50;

const STORAGE_KEY = 'atts-sync-history';

/** Persist items + lastCycleSummary to localStorage so Recently Synced survives refresh (BL-020). */
function persistToStorage(payload: { items: SyncedItem[]; lastCycleSummary: SyncCycleSummary | null }): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or privacy; ignore
  }
}

/** Load and rehydrate from localStorage; prune expired and trim to max. */
function loadFromStorage(): Pick<SyncHistoryState, 'items' | 'lastCycleSummary' | 'unacknowledgedCount'> | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { items?: SyncedItem[]; lastCycleSummary?: SyncCycleSummary | null };
    const now = Date.now();
    const items = (data.items ?? [])
      .filter((i) => i && now - (i.syncedAt ?? 0) < ITEM_TTL_MS)
      .slice(0, MAX_HISTORY_ITEMS);
    const lastCycleSummary = data.lastCycleSummary ?? null;
    const unacknowledgedCount = items.filter((i) => !i.acknowledged).length;
    return { items, lastCycleSummary, unacknowledgedCount };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SyncHistoryState {
  /** Recently synced items (newest first). */
  items: SyncedItem[];

  /** Most recent sync cycle summary (null if none or acknowledged). */
  lastCycleSummary: SyncCycleSummary | null;

  /** Count of unacknowledged items (for badge display). */
  unacknowledgedCount: number;

  // Actions
  /** Record a single item as successfully synced. */
  addSyncedItem: (item: Omit<SyncedItem, 'syncedAt' | 'acknowledged'>) => void;

  /** Record a full sync cycle summary. */
  addCycleSummary: (summary: Omit<SyncCycleSummary, 'id' | 'completedAt' | 'acknowledged'>) => void;

  /** Mark all items as acknowledged (user has seen the confirmations). */
  acknowledgeAll: () => void;

  /** Mark cycle summary as acknowledged. */
  acknowledgeSummary: () => void;

  /** Remove expired items (called periodically). */
  pruneExpired: () => void;

  /** Clear all history. */
  clear: () => void;
}

const initialState = loadFromStorage() ?? {
  items: [] as SyncedItem[],
  lastCycleSummary: null as SyncCycleSummary | null,
  unacknowledgedCount: 0,
};

export const useSyncHistory = create<SyncHistoryState>()((set) => ({
  ...initialState,

  addSyncedItem: (item) => {
    set((state) => {
      const newItem: SyncedItem = {
        ...item,
        syncedAt: Date.now(),
        acknowledged: false,
      };

      // Add to front, trim to max
      const items = [newItem, ...state.items].slice(0, MAX_HISTORY_ITEMS);
      const unacknowledgedCount = items.filter((i) => !i.acknowledged).length;

      return { items, unacknowledgedCount };
    });
  },

  addCycleSummary: (summary) => {
    // Only add if something actually happened
    if (summary.processed === 0 && summary.failed === 0 && summary.discarded === 0) return;

    set({
      lastCycleSummary: {
        ...summary,
        id: `cycle-${Date.now()}`,
        completedAt: Date.now(),
        acknowledged: false,
      },
    });
  },

  acknowledgeAll: () => {
    set((state) => ({
      items: state.items.map((i) => ({ ...i, acknowledged: true })),
      unacknowledgedCount: 0,
    }));
  },

  acknowledgeSummary: () => {
    set((state) => ({
      lastCycleSummary: state.lastCycleSummary
        ? { ...state.lastCycleSummary, acknowledged: true }
        : null,
    }));
  },

  pruneExpired: () => {
    const now = Date.now();
    set((state) => {
      const items = state.items.filter((i) => now - i.syncedAt < ITEM_TTL_MS);
      const unacknowledgedCount = items.filter((i) => !i.acknowledged).length;
      return { items, unacknowledgedCount };
    });
  },

  clear: () => set({ items: [], lastCycleSummary: null, unacknowledgedCount: 0 }),
}));

// Persist to localStorage on every state change so Recently Synced survives refresh (BL-020)
useSyncHistory.subscribe((state) => {
  persistToStorage({ items: state.items, lastCycleSummary: state.lastCycleSummary });
});

// Auto-prune expired items every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    useSyncHistory.getState().pruneExpired();
  }, 5 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

/** Get unacknowledged synced items. */
export function getUnacknowledgedItems(): SyncedItem[] {
  return useSyncHistory.getState().items.filter((i) => !i.acknowledged);
}

/** Get the most recent unacknowledged cycle summary. */
export function getUnacknowledgedSummary(): SyncCycleSummary | null {
  const summary = useSyncHistory.getState().lastCycleSummary;
  return summary && !summary.acknowledged ? summary : null;
}

// ---------------------------------------------------------------------------
// Human-friendly labels
// ---------------------------------------------------------------------------

const FORM_LABELS: Record<FormType, string> = {
  jsa: 'JSA',
  dvir: 'DVIR',
  equipment: 'Equipment Inspection',
  near_miss: 'Near-Miss Report',
  tree_felling_jsa: 'Tree Felling JSA',
  rto: 'RTO',
};

export function getFormLabel(formType: FormType): string {
  return FORM_LABELS[formType] || formType;
}
