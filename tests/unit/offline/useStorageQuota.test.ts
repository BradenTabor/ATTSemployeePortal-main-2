/**
 * Unit Tests: useStorageQuota Hook
 *
 * Tests for src/hooks/useStorageQuota.ts — initial fetch, critical/warning
 * thresholds, 30s polling interval.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStorageQuota } from '@/hooks/useStorageQuota';
import * as photoStore from '@/lib/offlinePhotoStore';

describe('useStorageQuota', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls estimateRemainingCapacity and getStorageUsage on mount', async () => {
    const estimateSpy = vi.spyOn(photoStore, 'estimateRemainingCapacity').mockResolvedValue({
      remainingPhotos: 500,
      usageBytes: 1000,
      quotaBytes: 500 * 1024 * 1024,
      available: true,
    });
    const usageSpy = vi.spyOn(photoStore, 'getStorageUsage').mockResolvedValue({
      count: 3,
      totalBytes: 1500,
    });

    const { result } = renderHook(() => useStorageQuota());

    // Resolve the initial async call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(estimateSpy).toHaveBeenCalled();
    expect(usageSpy).toHaveBeenCalled();
    expect(result.current.remainingPhotos).toBe(500);
    expect(result.current.storedPhotoCount).toBe(3);
    expect(result.current.storedPhotoBytes).toBe(1500);
    expect(result.current.available).toBe(true);
  });

  it('sets isCritical when remainingPhotos < 10', async () => {
    vi.spyOn(photoStore, 'estimateRemainingCapacity').mockResolvedValue({
      remainingPhotos: 5,
      usageBytes: 400 * 1024 * 1024,
      quotaBytes: 500 * 1024 * 1024,
      available: true,
    });
    vi.spyOn(photoStore, 'getStorageUsage').mockResolvedValue({
      count: 20,
      totalBytes: 10 * 1024 * 1024,
    });

    const { result } = renderHook(() => useStorageQuota());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.isCritical).toBe(true);
    expect(result.current.isWarning).toBe(true); // < 10 is also < 30
    expect(result.current.remainingPhotos).toBe(5);
  });

  it('sets isWarning when remainingPhotos < 30', async () => {
    vi.spyOn(photoStore, 'estimateRemainingCapacity').mockResolvedValue({
      remainingPhotos: 20,
      usageBytes: 300 * 1024 * 1024,
      quotaBytes: 500 * 1024 * 1024,
      available: true,
    });
    vi.spyOn(photoStore, 'getStorageUsage').mockResolvedValue({
      count: 10,
      totalBytes: 5 * 1024 * 1024,
    });

    const { result } = renderHook(() => useStorageQuota());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.isWarning).toBe(true);
    expect(result.current.isCritical).toBe(false);
  });

  it('neither critical nor warning when > 30 remaining', async () => {
    vi.spyOn(photoStore, 'estimateRemainingCapacity').mockResolvedValue({
      remainingPhotos: 100,
      usageBytes: 0,
      quotaBytes: 500 * 1024 * 1024,
      available: true,
    });
    vi.spyOn(photoStore, 'getStorageUsage').mockResolvedValue({
      count: 0,
      totalBytes: 0,
    });

    const { result } = renderHook(() => useStorageQuota());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.isWarning).toBe(false);
    expect(result.current.isCritical).toBe(false);
  });

  it('polls every 30 seconds', async () => {
    const estimateSpy = vi.spyOn(photoStore, 'estimateRemainingCapacity').mockResolvedValue({
      remainingPhotos: 100,
      usageBytes: 0,
      quotaBytes: 500 * 1024 * 1024,
      available: true,
    });
    vi.spyOn(photoStore, 'getStorageUsage').mockResolvedValue({ count: 0, totalBytes: 0 });

    renderHook(() => useStorageQuota());

    // Initial call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const initialCallCount = estimateSpy.mock.calls.length;

    // Advance 30s — should poll again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(estimateSpy.mock.calls.length).toBeGreaterThan(initialCallCount);

    // Advance another 30s — should poll again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(estimateSpy.mock.calls.length).toBeGreaterThan(initialCallCount + 1);
  });

  it('computes usagePercent correctly', async () => {
    vi.spyOn(photoStore, 'estimateRemainingCapacity').mockResolvedValue({
      remainingPhotos: 50,
      usageBytes: 250 * 1024 * 1024,
      quotaBytes: 500 * 1024 * 1024,
      available: true,
    });
    vi.spyOn(photoStore, 'getStorageUsage').mockResolvedValue({ count: 5, totalBytes: 2500 });

    const { result } = renderHook(() => useStorageQuota());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.usagePercent).toBe(50);
  });
});
