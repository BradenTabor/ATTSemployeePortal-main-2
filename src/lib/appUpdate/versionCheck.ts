/**
 * `/version.json` probe. Pure functions + one network call; no side effects on
 * the page. The controller decides what to do with the answer.
 */

import type { RemoteVersion } from './types';

export const VERSION_URL = '/version.json';

export function isRemoteVersion(value: unknown): value is RemoteVersion {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === 'string' && typeof v.buildTime === 'string' && v.buildTime.length > 0;
}

/**
 * Fetch the deployed build descriptor, bypassing every cache layer. Returns
 * null on any failure (offline, 404 in dev, malformed JSON) — callers treat
 * null as "unknown", never as "new version".
 */
export async function fetchRemoteVersion(
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<RemoteVersion | null> {
  try {
    const response = await fetchImpl(`${VERSION_URL}?t=${now}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isRemoteVersion(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Is `remote` a different deploy than the build this page is running?
 * buildTime is the discriminator (unique per build, also baked into the bundle);
 * `version` alone is not enough because most deploys do not bump package.json.
 */
export function isDifferentBuild(remote: RemoteVersion | null, localBuildTime: string): boolean {
  if (!remote) return false;
  return remote.buildTime !== localBuildTime;
}
