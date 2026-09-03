/**
 * AppUpdateController — the one place that decides when the app updates.
 *
 * Signals in:
 *   - service worker `waiting` (new build installed) → ready
 *   - `/version.json` differs from the running build → downloading → (SW update) → ready
 *   - `vite:preloadError` (stale chunk after a deploy) → blocking update
 *
 * Policy out (see `evaluatePolicy`):
 *   - at launch, before the user touches anything → apply silently
 *   - mid-session on a safe route, offline queue empty → 10 s countdown, then apply
 *   - mid-session on a form / with pending offline work → show prompt, wait
 *   - "Later" → snooze 30 min (still applies at next launch)
 *   - anything that could loop → stop and hand control to the user
 *
 * The page is only ever reloaded AFTER the new worker has taken control
 * (`controllerchange`), so a reload always lands on the new shell. The old
 * "reload because version.json disagrees" path — the source of the reload loop
 * — is gone; the version poll now only asks the browser to fetch the new worker.
 */

import { logger } from '../logger';
import { useAppUpdateStore } from './store';
import { canAutoReload, consumeAppliedUpdate, markUpToDate, recordReload, setAppliedUpdate } from './reloadGuard';
import { fetchRemoteVersion, isDifferentBuild } from './versionCheck';
import { isAutoApplySafeRoute } from './safeRoutes';
import type { AppUpdateConfig, AppUpdateState, RemoteVersion, ServiceWorkerAdapter } from './types';
import { DEFAULT_APP_UPDATE_CONFIG } from './types';

export type ApplyTrigger = 'launch' | 'auto' | 'user' | 'chunk-error';

export interface AppUpdateControllerDeps {
  adapter: ServiceWorkerAdapter;
  localVersion: string;
  localBuildTime: string;
  getQueueLength: () => Promise<number>;
  fetchImpl?: typeof fetch;
  reload?: () => void;
  now?: () => number;
  config?: Partial<AppUpdateConfig>;
  /** Route safety for the current URL; overridden live by the React hook. */
  isSafeRoute?: (pathname: string) => boolean;
}

const QUEUE_POLL_MS = 4_000;
const LAUNCH_DOWNLOAD_GRACE_MS = 60_000;
const NO_TARGET = 'sw-waiting';

export class AppUpdateController {
  private readonly adapter: ServiceWorkerAdapter;
  private readonly localVersion: string;
  private readonly localBuildTime: string;
  private readonly getQueueLength: () => Promise<number>;
  private readonly fetchImpl: typeof fetch;
  private readonly reloadPage: () => void;
  private readonly now: () => number;
  private readonly config: AppUpdateConfig;
  private readonly isSafeRouteFn: (pathname: string) => boolean;

  private started = false;
  private startedAt = 0;
  private userInteracted = false;
  private downloadingSince: number | null = null;
  private lastCheckAt = 0;
  private checkInFlight: Promise<void> | null = null;
  private routeSafe = true;
  private reloading = false;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private queueTimer: ReturnType<typeof setInterval> | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTicker: ReturnType<typeof setInterval> | null = null;
  private applyTimer: ReturnType<typeof setTimeout> | null = null;
  private downloadTimer: ReturnType<typeof setTimeout> | null = null;
  private snoozeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly cleanups: Array<() => void> = [];

  constructor(deps: AppUpdateControllerDeps) {
    this.adapter = deps.adapter;
    this.localVersion = deps.localVersion;
    this.localBuildTime = deps.localBuildTime;
    this.getQueueLength = deps.getQueueLength;
    this.fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
    this.reloadPage = deps.reload ?? (() => window.location.reload());
    this.now = deps.now ?? (() => Date.now());
    this.config = { ...DEFAULT_APP_UPDATE_CONFIG, ...deps.config };
    this.isSafeRouteFn = deps.isSafeRoute ?? isAutoApplySafeRoute;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    if (this.started) return;
    this.started = true;
    this.startedAt = this.now();

    this.confirmPreviousApply();

    if (typeof window !== 'undefined') {
      this.routeSafe = this.isSafeRouteFn(window.location.pathname);
      this.listen(window, 'pointerdown', this.onFirstInteraction, { once: true, passive: true });
      this.listen(window, 'keydown', this.onFirstInteraction, { once: true });
      this.listen(window, 'vite:preloadError', this.onPreloadError);
      this.listen(window, 'focus', () => void this.checkNow('focus'));
      this.listen(window, 'online', () => void this.checkNow('online'));
    }
    if (typeof document !== 'undefined') {
      this.listen(document, 'visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.checkNow('visibility');
      });
    }

    void this.registerServiceWorker();
    void this.checkNow('start', true);

    this.pollTimer = setInterval(() => void this.checkNow('interval'), this.config.pollIntervalMs);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.stopQueueWatch();
    this.cancelCountdown();
    this.clearTimer('applyTimer');
    this.clearTimer('downloadTimer');
    this.clearTimer('snoozeTimer');
    this.pollTimer = null;
  }

  // ---------------------------------------------------------------------------
  // Inputs from the UI layer
  // ---------------------------------------------------------------------------

  /** The router tells us whether the current route tolerates an automatic reload. */
  setRoute(pathname: string): void {
    const safe = this.isSafeRouteFn(pathname);
    if (safe === this.routeSafe) return;
    this.routeSafe = safe;
    this.evaluatePolicy();
  }

  /** "Later": hide the prompt for a while. Never blocks the next-launch apply. */
  snooze(): void {
    const until = this.now() + this.config.snoozeMs;
    this.patch({ snoozedUntil: until });
    this.cancelCountdown();
    this.clearTimer('snoozeTimer');
    this.snoozeTimer = setTimeout(() => {
      this.snoozeTimer = null;
      this.patch({ snoozedUntil: null });
      this.evaluatePolicy();
    }, this.config.snoozeMs);
  }

  /** Clear the post-update toast marker. */
  acknowledgeApplied(): void {
    this.patch({ appliedUpdate: null });
  }

  /** Manual "Update now". Bypasses the countdown, route safety and queue deferral. */
  async applyNow(): Promise<void> {
    await this.apply('user');
  }

  /**
   * Manual last resort: drop every worker + cache and load fresh from the network.
   * Only reachable from the `failed` UI; recorded but never blocked by the guard.
   */
  async hardReset(): Promise<void> {
    if (this.reloading) return;
    this.reloading = true;
    this.patch({ status: 'applying', error: null });
    setAppliedUpdate(
      { fromVersion: this.localVersion, fromBuildTime: this.localBuildTime, toVersion: this.state.targetVersion ?? 'latest' },
      this.now(),
    );
    recordReload('hard-reset', this.now());
    try {
      await this.adapter.hardReset();
    } catch (error) {
      logger.warn('[AppUpdate] hardReset failed, reloading anyway', error);
    }
    this.reloadPage();
  }

  /** Force a version check now (ignores the throttle). */
  async checkForUpdates(): Promise<void> {
    await this.checkNow('manual', true);
  }

  // ---------------------------------------------------------------------------
  // Service worker
  // ---------------------------------------------------------------------------

  private async registerServiceWorker(): Promise<void> {
    if (!this.adapter.supported) {
      logger.info('[AppUpdate] service workers unsupported; version poll only');
      return;
    }
    const registration = await this.adapter.register({
      onWaiting: () => this.onWorkerWaiting(),
      onControlling: () => this.onControllerChange(),
      onRegisterError: (error) => logger.warn('[AppUpdate] SW registration failed', error),
    });
    if (registration && this.adapter.hasWaitingWorker() && this.state.status !== 'ready') {
      this.onWorkerWaiting();
    }
  }

  private onWorkerWaiting(): void {
    if (this.state.status === 'applying') return;
    const now = this.now();
    logger.info('[AppUpdate] new service worker waiting');
    this.clearTimer('downloadTimer');
    this.patch({
      status: 'ready',
      reason: this.state.reason ?? 'sw-waiting',
      readyAt: this.state.readyAt ?? now,
      error: null,
    });
    if (!this.state.targetBuildTime) void this.checkNow('sw-waiting', true);
    this.startQueueWatch();
    void this.refreshQueueCount().then(() => this.evaluatePolicy());
  }

  private onControllerChange(): void {
    if (this.state.status !== 'applying' || this.reloading) return;
    this.reloading = true;
    this.clearTimer('applyTimer');
    logger.info('[AppUpdate] new worker took control — reloading once');
    this.reloadPage();
  }

  private onPreloadError = (): void => {
    logger.warn('[AppUpdate] lazy chunk failed to load; checking for a newer build');
    void this.checkNow('chunk-error', true).then(() => {
      const { status } = this.state;
      if (status === 'ready' || status === 'downloading') {
        this.patch({ reason: 'chunk-error', blocking: true, snoozedUntil: null });
        this.evaluatePolicy();
      }
    });
  };

  private onFirstInteraction = (): void => {
    this.userInteracted = true;
  };

  // ---------------------------------------------------------------------------
  // Version poll
  // ---------------------------------------------------------------------------

  private async checkNow(trigger: string, force = false): Promise<void> {
    if (!this.started) return;
    if (this.checkInFlight) return this.checkInFlight;
    const now = this.now();
    if (!force && now - this.lastCheckAt < this.config.minCheckGapMs) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    this.lastCheckAt = now;

    this.checkInFlight = (async () => {
      const remote = await fetchRemoteVersion(this.fetchImpl, now);
      this.patch({ lastCheckedAt: this.now() });
      if (remote) this.handleRemote(remote, trigger);
    })().finally(() => {
      this.checkInFlight = null;
    });
    return this.checkInFlight;
  }

  private handleRemote(remote: RemoteVersion, trigger: string): void {
    const { status } = this.state;

    if (!isDifferentBuild(remote, this.localBuildTime)) {
      markUpToDate();
      if (status === 'downloading') {
        // Server now agrees with us (rollback or propagation settled). Stand down.
        this.clearTimer('downloadTimer');
        this.downloadingSince = null;
        this.patch({ status: 'idle', reason: null, targetVersion: null, targetBuildTime: null, blocking: false });
      }
      return;
    }

    this.patch({ targetVersion: remote.version, targetBuildTime: remote.buildTime });

    if (status === 'idle') {
      logger.info(`[AppUpdate] newer build on server (${remote.version} @ ${remote.buildTime}) via ${trigger}`);
      this.downloadingSince = this.now();
      this.patch({ status: 'downloading', reason: this.state.reason ?? 'version-poll', error: null });
      this.armDownloadTimeout();
    }

    // From `failed` we keep nudging the browser for the new worker (so a later
    // `waiting` can still flip us to ready) but never re-enter `downloading`
    // on our own — that would flicker the UI and re-arm the reload path.
    if (status === 'idle' || status === 'downloading' || status === 'failed') {
      void this.adapter.checkForUpdate();
    }
  }

  private armDownloadTimeout(): void {
    this.clearTimer('downloadTimer');
    this.downloadTimer = setTimeout(() => {
      this.downloadTimer = null;
      if (this.state.status !== 'downloading') return;
      const target = this.state.targetBuildTime ?? NO_TARGET;

      if (!this.adapter.isControlled()) {
        // No worker owns this page, so a plain reload fetches the new shell
        // straight from the network. Allowed once per target build.
        if (canAutoReload(target, this.now())) {
          this.reloadOnce(target, 'downloading-no-sw');
          return;
        }
      }
      logger.warn('[AppUpdate] update did not become ready in time');
      this.patch({ status: 'failed', error: 'The update is taking longer than expected.' });
    }, this.config.downloadTimeoutMs);
  }

  // ---------------------------------------------------------------------------
  // Policy
  // ---------------------------------------------------------------------------

  private evaluatePolicy(): void {
    const state = this.state;
    if (state.status !== 'ready') {
      this.cancelCountdown();
      return;
    }

    if (state.blocking) {
      void this.apply('chunk-error');
      return;
    }

    const queueEmpty = state.pendingQueueCount === 0;

    if (queueEmpty && this.isLaunchPhase()) {
      void this.apply('launch');
      return;
    }

    if (state.snoozedUntil && state.snoozedUntil > this.now()) {
      this.cancelCountdown();
      return;
    }

    if (!queueEmpty || !this.routeSafe) {
      this.cancelCountdown();
      return;
    }

    this.startCountdown();
  }

  private isLaunchPhase(): boolean {
    if (this.userInteracted) return false;
    const elapsed = this.now() - this.startedAt;
    if (elapsed < this.config.launchWindowMs) return true;
    // The download started during the launch window and finished while the user
    // was still just looking at the screen — still effectively "at launch".
    return (
      this.downloadingSince !== null &&
      this.downloadingSince - this.startedAt < this.config.launchWindowMs &&
      elapsed < LAUNCH_DOWNLOAD_GRACE_MS
    );
  }

  private startCountdown(): void {
    if (this.countdownTimer) return;
    const endsAt = this.now() + this.config.countdownMs;
    this.patch({ countdownEndsAt: endsAt, countdownSecondsLeft: Math.ceil(this.config.countdownMs / 1000) });
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.stopCountdownTicker();
      void this.apply('auto');
    }, this.config.countdownMs);
    this.countdownTicker = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - this.now()) / 1000));
      if (left !== this.state.countdownSecondsLeft) this.patch({ countdownSecondsLeft: left });
    }, 250);
  }

  private cancelCountdown(): void {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.stopCountdownTicker();
    if (this.state.countdownEndsAt !== null || this.state.countdownSecondsLeft !== null) {
      this.patch({ countdownEndsAt: null, countdownSecondsLeft: null });
    }
  }

  private stopCountdownTicker(): void {
    if (this.countdownTicker) {
      clearInterval(this.countdownTicker);
      this.countdownTicker = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------------------

  private async apply(trigger: ApplyTrigger): Promise<void> {
    if (this.reloading || this.state.status === 'applying') return;
    this.cancelCountdown();
    const target = this.state.targetBuildTime ?? NO_TARGET;

    if (!this.adapter.hasWaitingWorker()) {
      if (trigger !== 'user') {
        // Nothing to activate yet (e.g. ready from a stale event). Wait for the worker.
        return;
      }
      await this.recoverManually(target);
      return;
    }

    if (trigger !== 'user' && !canAutoReload(target, this.now())) {
      logger.warn('[AppUpdate] automatic apply blocked by reload guard');
      this.patch({
        status: 'failed',
        error: 'Automatic update was paused to prevent a reload loop. Tap Update to try again.',
      });
      return;
    }

    logger.info(`[AppUpdate] applying update (${trigger})`);
    this.patch({ status: 'applying', error: null });
    setAppliedUpdate(
      { fromVersion: this.localVersion, fromBuildTime: this.localBuildTime, toVersion: this.state.targetVersion ?? 'latest' },
      this.now(),
    );
    recordReload(target, this.now());

    this.clearTimer('applyTimer');
    this.applyTimer = setTimeout(() => {
      this.applyTimer = null;
      if (this.state.status !== 'applying' || this.reloading) return;
      logger.warn('[AppUpdate] new worker did not take control in time');
      this.patch({ status: 'failed', error: 'The update did not finish. Tap Update to try again.' });
    }, this.config.applyTimeoutMs);

    try {
      await this.adapter.activateWaiting();
    } catch (error) {
      logger.warn('[AppUpdate] activateWaiting failed', error);
    }
  }

  /**
   * User pressed Update but no worker is waiting: re-check the server, ask the
   * browser for the worker again, and give it a few seconds. If it still does
   * not show up, a single user-initiated reload is the honest next step.
   */
  private async recoverManually(target: string): Promise<void> {
    this.patch({ status: 'downloading', error: null });
    await this.checkNow('manual-recover', true);
    await this.adapter.checkForUpdate();

    const deadline = this.now() + 5_000;
    while (this.now() < deadline) {
      if (this.adapter.hasWaitingWorker()) {
        this.patch({ status: 'ready' });
        await this.apply('user');
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    if (!this.adapter.isControlled() || !this.adapter.supported) {
      this.reloadOnce(target, 'manual-no-sw');
      return;
    }
    this.patch({
      status: 'failed',
      error: 'Could not fetch the new version yet. Check your connection, then try again or reset the app.',
    });
  }

  private reloadOnce(target: string, why: string): void {
    if (this.reloading) return;
    this.reloading = true;
    logger.info(`[AppUpdate] reloading (${why})`);
    this.patch({ status: 'applying', error: null });
    setAppliedUpdate(
      { fromVersion: this.localVersion, fromBuildTime: this.localBuildTime, toVersion: this.state.targetVersion ?? 'latest' },
      this.now(),
    );
    recordReload(target, this.now());
    this.reloadPage();
  }

  /**
   * Runs once per page load. If the previous page applied an update, prove it:
   * a different buildTime means success (toast); the same buildTime means the
   * reload landed on the old shell — surface that instead of trying again.
   */
  private confirmPreviousApply(): void {
    const record = consumeAppliedUpdate();
    if (!record) return;
    if (record.fromBuildTime !== this.localBuildTime) {
      markUpToDate();
      this.patch({ appliedUpdate: { fromVersion: record.fromVersion, toVersion: this.localVersion } });
      return;
    }
    logger.warn('[AppUpdate] reload did not land on the new build');
    this.patch({
      status: 'failed',
      error: 'The app reloaded but is still on the old version. Tap Update to try again, or Reset app.',
    });
  }

  // ---------------------------------------------------------------------------
  // Offline queue awareness
  // ---------------------------------------------------------------------------

  private startQueueWatch(): void {
    if (this.queueTimer) return;
    this.queueTimer = setInterval(() => {
      void this.refreshQueueCount().then((changed) => {
        if (changed) this.evaluatePolicy();
      });
    }, QUEUE_POLL_MS);
  }

  private stopQueueWatch(): void {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }
  }

  private async refreshQueueCount(): Promise<boolean> {
    let count = 0;
    try {
      count = await this.getQueueLength();
    } catch {
      count = 0;
    }
    if (count === this.state.pendingQueueCount) return false;
    this.patch({ pendingQueueCount: count });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private get state(): AppUpdateState {
    return useAppUpdateStore.getState();
  }

  private patch(partial: Partial<AppUpdateState>): void {
    useAppUpdateStore.getState().patch(partial);
  }

  private clearTimer(name: 'applyTimer' | 'downloadTimer' | 'snoozeTimer'): void {
    const timer = this[name];
    if (timer) clearTimeout(timer);
    this[name] = null;
  }

  private listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K | 'vite:preloadError',
    handler: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void;
  private listen(target: Document, type: 'visibilitychange', handler: () => void): void;
  private listen(target: EventTarget, type: string, handler: (event: Event) => void, options?: AddEventListenerOptions): void {
    target.addEventListener(type, handler, options);
    this.cleanups.push(() => target.removeEventListener(type, handler, options));
  }
}
