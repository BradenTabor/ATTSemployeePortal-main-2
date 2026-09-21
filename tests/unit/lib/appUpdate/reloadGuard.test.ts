import { describe, it, expect, beforeEach } from 'vitest';
import {
  canAutoReload,
  recordReload,
  reloadCount,
  markUpToDate,
  setAppliedUpdate,
  consumeAppliedUpdate,
  MAX_RELOADS_PER_WINDOW,
  RELOAD_WINDOW_MS,
} from '@/lib/appUpdate/reloadGuard';

describe('reloadGuard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows the first automatic reload for a target', () => {
    expect(canAutoReload('build-A')).toBe(true);
  });

  it('never allows a second automatic reload for the same target build (the loop case)', () => {
    recordReload('build-A', 1_000);
    expect(canAutoReload('build-A', 2_000)).toBe(false);
    expect(canAutoReload('build-A', 1_000 + RELOAD_WINDOW_MS - 1)).toBe(false);
  });

  it('caps automatic reloads per rolling window across targets', () => {
    for (let i = 0; i < MAX_RELOADS_PER_WINDOW; i++) recordReload(`build-${i}`, 1_000 + i);
    expect(canAutoReload('build-new', 5_000)).toBe(false);
    expect(reloadCount(5_000)).toBe(MAX_RELOADS_PER_WINDOW);
  });

  it('forgets reloads once the window has elapsed', () => {
    recordReload('build-A', 1_000);
    recordReload('build-B', 1_001);
    expect(canAutoReload('build-A', 1_000 + RELOAD_WINDOW_MS + 1)).toBe(true);
  });

  it('markUpToDate clears the record so the next deploy gets a fresh budget', () => {
    recordReload('build-A', 1_000);
    markUpToDate();
    expect(canAutoReload('build-A', 2_000)).toBe(true);
  });

  it('round-trips the applied-update marker and clears it on read', () => {
    setAppliedUpdate({ fromVersion: '1.1.0', fromBuildTime: 'T1', toVersion: '1.2.0', toBuildTime: 'T2' }, 42);
    expect(consumeAppliedUpdate()).toEqual({
      fromVersion: '1.1.0',
      fromBuildTime: 'T1',
      toVersion: '1.2.0',
      toBuildTime: 'T2',
      at: 42,
    });
    expect(consumeAppliedUpdate()).toBeNull();
  });

  it('reads markers written before toBuildTime existed as "target unknown"', () => {
    sessionStorage.setItem(
      'atts-update-applied',
      JSON.stringify({ fromVersion: '1.1.0', fromBuildTime: 'T1', toVersion: 'latest', at: 1 }),
    );
    expect(consumeAppliedUpdate()?.toBuildTime).toBeNull();
  });

  it('ignores malformed storage contents', () => {
    sessionStorage.setItem('atts-update-reloads', '{not json');
    sessionStorage.setItem('atts-update-applied', '[]');
    expect(canAutoReload('x')).toBe(true);
    expect(consumeAppliedUpdate()).toBeNull();
  });
});
