import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppUpdateController } from '@/lib/appUpdate/controller';
import { useAppUpdateStore } from '@/lib/appUpdate/store';
import type { ServiceWorkerAdapter } from '@/lib/appUpdate/types';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

interface FakeAdapter {
  adapter: ServiceWorkerAdapter;
  emitWaiting: () => void;
  emitControlling: () => void;
  checkForUpdate: ReturnType<typeof vi.fn>;
  activateWaiting: ReturnType<typeof vi.fn>;
  hardReset: ReturnType<typeof vi.fn>;
  setControlled: (v: boolean) => void;
}

function createFakeAdapter(opts: { supported?: boolean; controlled?: boolean; installOnCheck?: boolean } = {}): FakeAdapter {
  const supported = opts.supported ?? true;
  let controlled = opts.controlled ?? true;
  let waiting = false;
  let handlers: Parameters<ServiceWorkerAdapter['register']>[0] | null = null;

  const emitWaiting = () => {
    waiting = true;
    handlers?.onWaiting();
  };

  const checkForUpdate = vi.fn(async () => {
    if (opts.installOnCheck) {
      // Simulate the browser fetching the new sw.js and installing it shortly after.
      setTimeout(emitWaiting, 500);
    }
  });
  const activateWaiting = vi.fn(async () => {});
  const hardReset = vi.fn(async () => {});

  return {
    adapter: {
      supported,
      async register(h) {
        handlers = h;
        return supported ? ({} as ServiceWorkerRegistration) : null;
      },
      checkForUpdate,
      hasWaitingWorker: () => waiting,
      activateWaiting,
      isControlled: () => supported && controlled,
      hardReset,
    },
    emitWaiting,
    emitControlling: () => {
      waiting = false;
      controlled = true;
      handlers?.onControlling();
    },
    checkForUpdate,
    activateWaiting,
    hardReset,
    setControlled: (v) => {
      controlled = v;
    },
  };
}

function fakeFetch(remote: { version: string; buildTime: string } | null) {
  return vi.fn(async () => {
    if (!remote) throw new TypeError('offline');
    return { ok: true, json: async () => remote } as unknown as Response;
  }) as unknown as typeof fetch;
}

const LOCAL = { version: '1.1.0', buildTime: '2026-09-01T00:00:00.000Z' };
const REMOTE_NEW = { version: '1.2.0', buildTime: '2026-09-02T00:00:00.000Z' };

const CONFIG = {
  pollIntervalMs: 60_000,
  minCheckGapMs: 1_000,
  launchWindowMs: 5_000,
  countdownMs: 10_000,
  snoozeMs: 30_000,
  applyTimeoutMs: 8_000,
  downloadTimeoutMs: 20_000,
};

function makeController(
  fake: FakeAdapter,
  overrides: Partial<ConstructorParameters<typeof AppUpdateController>[0]> = {},
) {
  const reload = vi.fn();
  const controller = new AppUpdateController({
    adapter: fake.adapter,
    localVersion: LOCAL.version,
    localBuildTime: LOCAL.buildTime,
    getQueueLength: async () => 0,
    fetchImpl: fakeFetch(REMOTE_NEW),
    reload,
    config: CONFIG,
    ...overrides,
  });
  return { controller, reload };
}

const state = () => useAppUpdateStore.getState();
const flush = () => vi.advanceTimersByTimeAsync(1);
const interact = () => window.dispatchEvent(new Event('pointerdown'));

let active: AppUpdateController | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
  sessionStorage.clear();
  useAppUpdateStore.getState().reset();
  // Default to a safe (read-only) route; individual tests move to forms via setRoute().
  window.history.replaceState({}, '', '/dashboard');
});

afterEach(() => {
  active?.stop();
  active = null;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// The reported bug: version.json is newer but the old worker keeps serving the
// old shell. The old pipeline hard-reloaded every few seconds forever.
// ---------------------------------------------------------------------------

describe('AppUpdateController — no reload loop', () => {
  it('never hard-reloads from the version poll while a worker controls the page', async () => {
    const fake = createFakeAdapter({ controlled: true });
    const { controller, reload } = makeController(fake);
    active = controller;
    controller.start();
    await flush();

    expect(state().status).toBe('downloading');
    expect(state().targetVersion).toBe('1.2.0');
    expect(fake.checkForUpdate).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(CONFIG.downloadTimeoutMs + 100);
    expect(state().status).toBe('failed');
    expect(state().error).toMatch(/taking longer/i);

    // Keep polling for a long time with the worker never becoming ready.
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(reload).not.toHaveBeenCalled();
    expect(state().status).toBe('failed');
    expect(fake.checkForUpdate.mock.calls.length).toBeGreaterThan(1); // still nudging the browser
  });

  it('reloads exactly once, and only after the new worker takes control', async () => {
    const fake = createFakeAdapter({ controlled: true, installOnCheck: true });
    const { controller, reload } = makeController(fake);
    active = controller;
    controller.start();
    await flush();
    expect(state().status).toBe('downloading');

    await vi.advanceTimersByTimeAsync(600); // sw.js fetched + installed → waiting
    expect(state().status).toBe('applying'); // launch phase: applied silently
    expect(fake.activateWaiting).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    fake.emitControlling();
    expect(reload).toHaveBeenCalledTimes(1);

    // Any further events cannot trigger another reload.
    fake.emitControlling();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('after the reload, the new build confirms the swap and stays idle', async () => {
    const fake = createFakeAdapter({ controlled: true, installOnCheck: true });
    const first = makeController(fake);
    first.controller.start();
    await vi.advanceTimersByTimeAsync(600);
    fake.emitControlling();
    first.controller.stop();
    expect(first.reload).toHaveBeenCalledTimes(1);

    // "Reload": a fresh controller running the NEW build against the same server.
    useAppUpdateStore.getState().reset();
    const fake2 = createFakeAdapter({ controlled: true });
    const second = makeController(fake2, {
      localVersion: REMOTE_NEW.version,
      localBuildTime: REMOTE_NEW.buildTime,
    });
    active = second.controller;
    second.controller.start();
    await flush();

    expect(state().appliedUpdate).toEqual({ fromVersion: '1.1.0', toVersion: '1.2.0' });
    expect(state().status).toBe('idle');
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(second.reload).not.toHaveBeenCalled();
  });

  it('if the reload lands on the OLD build again it stops and reports, instead of looping', async () => {
    const fake = createFakeAdapter({ controlled: true, installOnCheck: true });
    const first = makeController(fake);
    first.controller.start();
    await vi.advanceTimersByTimeAsync(600);
    fake.emitControlling();
    first.controller.stop();

    useAppUpdateStore.getState().reset();
    const fake2 = createFakeAdapter({ controlled: true, installOnCheck: true });
    const second = makeController(fake2); // same OLD build
    active = second.controller;
    second.controller.start();
    await flush();

    expect(state().status).toBe('failed');
    expect(state().error).toMatch(/still on the old version/i);

    // Even when the worker becomes ready again during launch, the guard refuses an automatic apply.
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(CONFIG.countdownMs + 1_000);
    expect(second.reload).not.toHaveBeenCalled();
    expect(state().status).toBe('failed');
  });

  it('a user tap always works even when the automatic guard is exhausted', async () => {
    sessionStorage.setItem(
      'atts-update-reloads',
      JSON.stringify([{ at: Date.now(), target: REMOTE_NEW.buildTime }]),
    );
    const fake = createFakeAdapter({ controlled: true });
    const { controller, reload } = makeController(fake);
    active = controller;
    controller.start();
    await flush();
    interact();
    fake.emitWaiting();
    await flush();
    expect(state().status).toBe('ready');

    await vi.advanceTimersByTimeAsync(CONFIG.countdownMs + 100);
    expect(state().status).toBe('failed'); // guard blocked the automatic apply
    expect(fake.activateWaiting).not.toHaveBeenCalled();

    await controller.applyNow();
    expect(state().status).toBe('applying');
    expect(fake.activateWaiting).toHaveBeenCalledTimes(1);
    fake.emitControlling();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

describe('AppUpdateController — policy', () => {
  it('mid-session on a safe route: shows a countdown, then applies', async () => {
    const fake = createFakeAdapter();
    const { controller, reload } = makeController(fake, { fetchImpl: fakeFetch(LOCAL) });
    active = controller;
    controller.start();
    await flush();
    interact();

    fake.emitWaiting();
    await flush();
    expect(state().status).toBe('ready');
    expect(state().countdownEndsAt).not.toBeNull();
    expect(state().countdownSecondsLeft).toBe(10);

    await vi.advanceTimersByTimeAsync(4_000);
    expect(state().countdownSecondsLeft).toBe(6);

    await vi.advanceTimersByTimeAsync(6_100);
    expect(state().status).toBe('applying');
    fake.emitControlling();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('on a form route: no countdown; countdown starts when the user leaves the form', async () => {
    const fake = createFakeAdapter();
    const { controller } = makeController(fake, { fetchImpl: fakeFetch(LOCAL) });
    active = controller;
    controller.start();
    await flush();
    interact();
    controller.setRoute('/forms/jsa');

    fake.emitWaiting();
    await flush();
    expect(state().status).toBe('ready');
    expect(state().countdownEndsAt).toBeNull();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(state().status).toBe('ready');
    expect(fake.activateWaiting).not.toHaveBeenCalled();

    controller.setRoute('/dashboard');
    expect(state().countdownEndsAt).not.toBeNull();
  });

  it('waits for pending offline submissions before auto-applying', async () => {
    let queue = 2;
    const fake = createFakeAdapter();
    const { controller } = makeController(fake, {
      fetchImpl: fakeFetch(LOCAL),
      getQueueLength: async () => queue,
    });
    active = controller;
    controller.start();
    await flush();

    fake.emitWaiting();
    await flush();
    expect(state().status).toBe('ready');
    expect(state().pendingQueueCount).toBe(2);
    expect(state().countdownEndsAt).toBeNull();

    // Still at launch phase (no interaction) but queue is non-empty → no silent apply.
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fake.activateWaiting).not.toHaveBeenCalled();
    expect(state().status).toBe('ready');

    queue = 0;
    await vi.advanceTimersByTimeAsync(4_100); // queue watcher tick
    expect(state().pendingQueueCount).toBe(0);
    // Past the launch window by now → normal countdown path.
    expect(state().countdownEndsAt).not.toBeNull();
  });

  it('"Later" snoozes the countdown and resumes after the snooze', async () => {
    const fake = createFakeAdapter();
    const { controller } = makeController(fake, { fetchImpl: fakeFetch(LOCAL) });
    active = controller;
    controller.start();
    await flush();
    interact();
    fake.emitWaiting();
    await flush();
    expect(state().countdownEndsAt).not.toBeNull();

    controller.snooze();
    expect(state().countdownEndsAt).toBeNull();
    expect(state().snoozedUntil).not.toBeNull();

    await vi.advanceTimersByTimeAsync(CONFIG.snoozeMs - 1_000);
    expect(fake.activateWaiting).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_100);
    expect(state().snoozedUntil).toBeNull();
    expect(state().countdownEndsAt).not.toBeNull();
  });

  it('stands down when the server reports the same build we are running', async () => {
    const fake = createFakeAdapter();
    const { controller, reload } = makeController(fake, { fetchImpl: fakeFetch(LOCAL) });
    active = controller;
    controller.start();
    await flush();
    expect(state().status).toBe('idle');
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(state().status).toBe('idle');
    expect(reload).not.toHaveBeenCalled();
    expect(fake.checkForUpdate).not.toHaveBeenCalled();
  });

  it('treats an unreachable version.json as "unknown", not as an update', async () => {
    const fake = createFakeAdapter();
    const { controller, reload } = makeController(fake, { fetchImpl: fakeFetch(null) });
    active = controller;
    controller.start();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(state().status).toBe('idle');
    expect(reload).not.toHaveBeenCalled();
  });

  it('a stale-chunk failure escalates to a blocking apply regardless of route or interaction', async () => {
    const fake = createFakeAdapter({ installOnCheck: true });
    const { controller, reload } = makeController(fake);
    active = controller;
    controller.start();
    await flush();
    interact();
    controller.setRoute('/forms/jsa');

    window.dispatchEvent(new Event('vite:preloadError'));
    await flush();
    expect(state().blocking).toBe(true);
    expect(state().reason).toBe('chunk-error');

    await vi.advanceTimersByTimeAsync(600); // worker installs
    expect(state().status).toBe('applying');
    fake.emitControlling();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('declares failure if the new worker never takes control after SKIP_WAITING', async () => {
    const fake = createFakeAdapter();
    const { controller, reload } = makeController(fake, { fetchImpl: fakeFetch(LOCAL) });
    active = controller;
    controller.start();
    await flush();
    fake.emitWaiting();
    await flush();
    expect(state().status).toBe('applying');

    await vi.advanceTimersByTimeAsync(CONFIG.applyTimeoutMs + 100);
    expect(state().status).toBe('failed');
    expect(reload).not.toHaveBeenCalled();
  });

  it('without service worker support, reloads once from the network when the server is newer', async () => {
    const fake = createFakeAdapter({ supported: false });
    const { controller, reload } = makeController(fake);
    active = controller;
    controller.start();
    await flush();
    expect(state().status).toBe('downloading');

    await vi.advanceTimersByTimeAsync(CONFIG.downloadTimeoutMs + 100);
    expect(reload).toHaveBeenCalledTimes(1);

    // The "reloaded" page is still old (e.g. proxy cache): must not reload again.
    controller.stop();
    useAppUpdateStore.getState().reset();
    const second = makeController(createFakeAdapter({ supported: false }));
    active = second.controller;
    second.controller.start();
    await vi.advanceTimersByTimeAsync(CONFIG.downloadTimeoutMs + 100);
    expect(second.reload).not.toHaveBeenCalled();
    expect(state().status).toBe('failed');
  });

  it('hard reset wipes workers/caches and reloads, recording the attempt', async () => {
    const fake = createFakeAdapter();
    const { controller, reload } = makeController(fake);
    active = controller;
    controller.start();
    await flush();
    await controller.hardReset();
    expect(fake.hardReset).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('atts-update-applied')).not.toBeNull();
  });
});
