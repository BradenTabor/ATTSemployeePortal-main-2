import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppUpdateManager, type AppUpdateState } from '../../src/lib/appUpdateManager';

function setup(waiting = true, controlled = true) {
  const worker = Object.assign(new EventTarget(), { state: 'installed', postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting ? worker : null, installing: null as typeof worker | null, update: vi.fn().mockResolvedValue(undefined),
  });
  const workers = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null as object | null,
    register: vi.fn().mockResolvedValue(registration),
  });
  const states: AppUpdateState[] = [];
  const reload = vi.fn();
  const manager = createAppUpdateManager(workers as unknown as ServiceWorkerContainer, state => states.push(state), reload);
  const activate = () => { workers.controller = {}; workers.dispatchEvent(new Event('controllerchange')); };
  return { manager, worker, workers, registration, states, reload, activate };
}
afterEach(() => vi.useRealTimers());

describe('app updates', () => {
  it('recovers from registration failure on the next online check', async () => {
    const t = setup();
    t.workers.register.mockRejectedValueOnce(new Error('network unavailable'));
    await t.manager.start('/sw.js');
    expect(t.states.at(-1)?.error).toContain('temporarily unavailable');
    await t.manager.check();
    expect(t.workers.register).toHaveBeenCalledTimes(2);
    expect(t.states.at(-1)).toMatchObject({ available: true, error: null });
    t.manager.dispose();
  });
  it('offers a waiting release without reloading, then reloads once after activation', async () => {
    const t = setup();
    await t.manager.start('/sw.js');
    expect(t.workers.register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
    expect(t.states.at(-1)?.available).toBe(true);
    expect(t.reload).not.toHaveBeenCalled();
    t.manager.apply(); t.manager.apply();
    expect(t.worker.postMessage).toHaveBeenCalledTimes(1);
    expect(t.reload).not.toHaveBeenCalled();
    t.activate(); t.activate();
    expect(t.reload).toHaveBeenCalledTimes(1);
    t.manager.dispose();
  });
  it('does not treat first installation as an update', async () => {
    const t = setup(false, false);
    await t.manager.start('/sw.js'); t.activate();
    expect(t.reload).not.toHaveBeenCalled();
    expect(t.states.some(s => s.available)).toBe(false);
    t.manager.dispose();
  });
  it('waits for installation before offering the update', async () => {
    const t = setup(false);
    await t.manager.start('/sw.js');
    t.registration.installing = t.worker;
    t.registration.dispatchEvent(new Event('updatefound'));
    expect(t.states.some(s => s.available)).toBe(false);
    t.registration.waiting = t.worker;
    t.worker.dispatchEvent(new Event('statechange'));
    expect(t.states.at(-1)?.available).toBe(true);
    t.manager.dispose();
  });
  it('times out without reload or deleting caches and permits retry', async () => {
    vi.useFakeTimers();
    const t = setup();
    await t.manager.start('/sw.js'); t.manager.apply();
    await vi.advanceTimersByTimeAsync(20000);
    expect(t.states.at(-1)).toMatchObject({ updating: false, available: true });
    expect(t.states.at(-1)?.error).toContain('try again');
    expect(t.reload).not.toHaveBeenCalled();
    t.manager.apply(); t.activate();
    expect(t.worker.postMessage).toHaveBeenCalledTimes(2);
    expect(t.reload).toHaveBeenCalledTimes(1);
    t.manager.dispose();
  });
  it('requires consent when another tab activates a release', async () => {
    const t = setup(false);
    await t.manager.start('/sw.js'); t.activate();
    expect(t.reload).not.toHaveBeenCalled();
    expect(t.states.at(-1)?.available).toBe(true);
    t.manager.apply();
    expect(t.reload).toHaveBeenCalledTimes(1);
    t.manager.dispose();
  });
  it('cleans listeners and timers on unmount, including pending registration', async () => {
    const t = setup();
    const started = t.manager.start('/sw.js');
    t.manager.dispose(); await started; t.activate();
    expect(t.states).toEqual([]);
    expect(t.reload).not.toHaveBeenCalled();
  });
  it('coalesces checks and leaves the app working when downloading fails', async () => {
    const t = setup(false);
    await t.manager.start('/sw.js'); await Promise.resolve();
    t.registration.update.mockClear().mockRejectedValue(new Error('offline'));
    await Promise.all([t.manager.check(), t.manager.check()]);
    expect(t.registration.update).toHaveBeenCalledTimes(1);
    expect(t.reload).not.toHaveBeenCalled();
    expect(t.states.some(s => s.available)).toBe(false);
    t.manager.dispose();
  });
});
