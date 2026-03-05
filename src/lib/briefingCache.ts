/**
 * Offline cache for daily safety briefing announcement.
 * Keyed by Chicago date (YYYY-MM-DD); 24h TTL. Used when network fails so the
 * briefing page can still show today's message.
 */

import { openDB } from 'idb';
import { logger } from './logger';

const DB_NAME = 'atts-briefing-cache';
const DB_VERSION = 1;
const STORE_NAME = 'by_date';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedAnnouncement {
  id: string;
  title: string;
  message: string;
  author: string;
  date: string;
  created_at: string;
  raw_data?: Record<string, unknown>;
  fetched_at: number;
}

let dbPromise: ReturnType<typeof openDB> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'date' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get cached announcement for a date if present and not expired (24h TTL).
 */
export async function getBriefingCache(date: string): Promise<CachedAnnouncement | null> {
  const db = await getDB();
  if (!db) return null;
  try {
    const raw = await db.get(STORE_NAME, date);
    if (!raw || typeof raw !== 'object' || !('fetched_at' in raw)) return null;
    const fetchedAt = (raw as CachedAnnouncement).fetched_at;
    if (Date.now() - fetchedAt > TTL_MS) {
      await db.delete(STORE_NAME, date);
      return null;
    }
    return raw as CachedAnnouncement;
  } catch (e) {
    logger.warn('[BriefingCache] get failed', e);
    return null;
  }
}

/**
 * Store announcement for its date. Call after successful network fetch.
 */
export async function setBriefingCache(announcement: Omit<CachedAnnouncement, 'fetched_at'>): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const date = announcement.date.slice(0, 10);
  try {
    await db.put(STORE_NAME, {
      ...announcement,
      date,
      fetched_at: Date.now(),
    });
  } catch (e) {
    logger.warn('[BriefingCache] set failed', e);
  }
}
