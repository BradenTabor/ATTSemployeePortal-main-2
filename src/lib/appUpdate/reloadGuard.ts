/**
 * Reload loop guard.
 *
 * The old pipeline hard-reloaded whenever `/version.json` disagreed with the
 * running build and reset its own attempt counter on every mount — so when the
 * service worker kept serving the old shell, the app reloaded forever.
 *
 * Rules here:
 *   1. At most ONE automatic reload per target build (identified by buildTime).
 *   2. At most MAX_RELOADS_PER_WINDOW automatic reloads per rolling window, any target.
 *   3. The record is cleared only when the running build is proven current
 *      (`markUpToDate()`), never on mount.
 *
 * User-initiated reloads are recorded but never blocked.
 */

const RELOADS_KEY = 'atts-update-reloads';
const APPLIED_KEY = 'atts-update-applied';

export const MAX_RELOADS_PER_WINDOW = 2;
export const RELOAD_WINDOW_MS = 10 * 60 * 1000;

interface ReloadRecord {
  at: number;
  target: string;
}

export interface AppliedUpdateRecord {
  /** Version running when the update was applied. */
  fromVersion: string;
  /** buildTime running when the update was applied — compared after reload to prove the swap. */
  fromBuildTime: string;
  /** Version we were updating to (when known). */
  toVersion: string;
  /**
   * buildTime we were updating to, when `/version.json` told us. `null` when the
   * only signal was a waiting worker — in that case a same-buildTime landing is
   * NOT proof of failure (worker-only change, or dev server), so the next
   * version check decides.
   */
  toBuildTime: string | null;
  at: number;
}

function readRecords(): ReloadRecord[] {
  try {
    const raw = sessionStorage.getItem(RELOADS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ReloadRecord =>
        typeof r === 'object' && r !== null && typeof (r as ReloadRecord).at === 'number' && typeof (r as ReloadRecord).target === 'string',
    );
  } catch {
    return [];
  }
}

function writeRecords(records: ReloadRecord[]): void {
  try {
    sessionStorage.setItem(RELOADS_KEY, JSON.stringify(records));
  } catch {
    // Storage unavailable (private mode / quota). Guard degrades to "allow once" per page load.
  }
}

function recentRecords(now: number): ReloadRecord[] {
  return readRecords().filter((r) => now - r.at < RELOAD_WINDOW_MS);
}

/**
 * May the app reload itself right now to pick up `target`?
 * `target` is the buildTime (or any stable id) of the build we are trying to reach.
 */
export function canAutoReload(target: string, now: number = Date.now()): boolean {
  const recent = recentRecords(now);
  if (recent.some((r) => r.target === target)) return false;
  return recent.length < MAX_RELOADS_PER_WINDOW;
}

/** Record that a reload is about to happen for `target`. */
export function recordReload(target: string, now: number = Date.now()): void {
  const recent = recentRecords(now);
  recent.push({ at: now, target });
  writeRecords(recent);
}

/** How many automatic reloads have been recorded in the current window. */
export function reloadCount(now: number = Date.now()): number {
  return recentRecords(now).length;
}

/** The running build has been confirmed to match the server — forget past reloads. */
export function markUpToDate(): void {
  try {
    sessionStorage.removeItem(RELOADS_KEY);
  } catch {
    // ignore
  }
}

/** Remember which update is being applied so the next page load can confirm it. */
export function setAppliedUpdate(record: Omit<AppliedUpdateRecord, 'at'>, now: number = Date.now()): void {
  try {
    sessionStorage.setItem(APPLIED_KEY, JSON.stringify({ ...record, at: now }));
  } catch {
    // ignore
  }
}

/** Read and clear the "update applied" marker written before the last reload. */
export function consumeAppliedUpdate(): AppliedUpdateRecord | null {
  try {
    const raw = sessionStorage.getItem(APPLIED_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(APPLIED_KEY);
    const parsed = JSON.parse(raw) as Partial<AppliedUpdateRecord>;
    if (
      typeof parsed.fromVersion !== 'string' ||
      typeof parsed.fromBuildTime !== 'string' ||
      typeof parsed.toVersion !== 'string' ||
      typeof parsed.at !== 'number'
    ) {
      return null;
    }
    return {
      fromVersion: parsed.fromVersion,
      fromBuildTime: parsed.fromBuildTime,
      toVersion: parsed.toVersion,
      toBuildTime: typeof parsed.toBuildTime === 'string' ? parsed.toBuildTime : null,
      at: parsed.at,
    };
  } catch {
    return null;
  }
}
