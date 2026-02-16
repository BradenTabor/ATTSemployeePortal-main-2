/**
 * Hook: Storage Quota Monitoring
 *
 * Reports remaining photo capacity in user-friendly numbers.
 * Updates every 30 seconds while the component is mounted.
 *
 * @module useStorageQuota
 */

import { useCallback, useEffect, useState } from 'react';
import {
  estimateRemainingCapacity,
  getStorageUsage,
} from '../lib/offlinePhotoStore';

export interface StorageQuotaInfo {
  /** Approximate remaining photo capacity. */
  remainingPhotos: number;
  /** Total photos currently stored offline. */
  storedPhotoCount: number;
  /** Total bytes used by offline photos. */
  storedPhotoBytes: number;
  /** Total device storage used (all origins). */
  usageBytes: number;
  /** Total device storage quota. */
  quotaBytes: number;
  /** Usage percentage (0-100). */
  usagePercent: number;
  /** Whether the Storage API is available. */
  available: boolean;
  /** Storage is critically low (< 10 photos remaining). */
  isCritical: boolean;
  /** Storage is getting low (< 30 photos remaining). */
  isWarning: boolean;
}

const POLL_INTERVAL_MS = 30_000;

export function useStorageQuota(): StorageQuotaInfo {
  const [info, setInfo] = useState<StorageQuotaInfo>({
    remainingPhotos: 100,
    storedPhotoCount: 0,
    storedPhotoBytes: 0,
    usageBytes: 0,
    quotaBytes: 0,
    usagePercent: 0,
    available: false,
    isCritical: false,
    isWarning: false,
  });

  const refresh = useCallback(async () => {
    const [capacity, usage] = await Promise.all([
      estimateRemainingCapacity(),
      getStorageUsage(),
    ]);

    const usagePercent = capacity.quotaBytes > 0
      ? Math.round((capacity.usageBytes / capacity.quotaBytes) * 100)
      : 0;

    setInfo({
      remainingPhotos: capacity.remainingPhotos,
      storedPhotoCount: usage.count,
      storedPhotoBytes: usage.totalBytes,
      usageBytes: capacity.usageBytes,
      quotaBytes: capacity.quotaBytes,
      usagePercent,
      available: capacity.available,
      isCritical: capacity.remainingPhotos < 10,
      isWarning: capacity.remainingPhotos < 30,
    });
  }, []);

  useEffect(() => {
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh]);

  return info;
}
