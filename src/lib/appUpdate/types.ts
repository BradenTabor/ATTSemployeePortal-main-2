/**
 * App update pipeline — shared types.
 *
 * One state machine owns every "new version" signal in the app:
 *   - the service worker reaching `waiting` (a new build is installed locally)
 *   - `/version.json` reporting a newer build than the one running
 *   - a stale-chunk failure (`vite:preloadError`) after a deploy
 */

export type AppUpdateStatus =
  /** Running build matches the server (or nothing known yet). */
  | 'idle'
  /** A newer build exists on the server; the service worker is fetching it. */
  | 'downloading'
  /** The new service worker is installed and waiting — one activation away. */
  | 'ready'
  /** SKIP_WAITING sent; waiting for the new worker to take control, then reload. */
  | 'applying'
  /** The update could not be applied automatically; manual controls are shown. */
  | 'failed';

export type AppUpdateReason =
  /** `/version.json` reported a build that differs from the running one. */
  | 'version-poll'
  /** The service worker reported a waiting (updated) worker. */
  | 'sw-waiting'
  /** A lazy chunk failed to load — the running build is stale on the server. */
  | 'chunk-error';

export interface RemoteVersion {
  version: string;
  buildTime: string;
  commit?: string;
  environment?: string;
}

export interface AppUpdateState {
  status: AppUpdateStatus;
  reason: AppUpdateReason | null;
  /** Version string of the build we are updating to (from version.json), if known. */
  targetVersion: string | null;
  /** buildTime of the build we are updating to, if known. */
  targetBuildTime: string | null;
  /** Epoch ms when status became `ready`. */
  readyAt: number | null;
  /** Epoch ms until which the user asked us not to nag ("Later"). */
  snoozedUntil: number | null;
  /** Epoch ms at which the auto-apply countdown fires; null when no countdown is running. */
  countdownEndsAt: number | null;
  /** Whole seconds left on the countdown (ticked by the controller); null when none is running. */
  countdownSecondsLeft: number | null;
  /** Pending + failed offline submissions. Auto-apply waits for 0. */
  pendingQueueCount: number;
  /** True when the update should block the UI (the running build cannot load its own chunks). */
  blocking: boolean;
  /** Human-readable reason for `failed`. */
  error: string | null;
  lastCheckedAt: number | null;
  /** Set after a reload that completed an update, until the UI acknowledges it. */
  appliedUpdate: AppliedUpdate | null;
}

export interface AppliedUpdate {
  fromVersion: string;
  toVersion: string;
}

/**
 * Minimal service-worker surface the controller needs. Injected so the
 * controller stays unit-testable without a real `navigator.serviceWorker`
 * or the `virtual:pwa-register` module.
 */
export interface ServiceWorkerAdapter {
  /** Whether service workers are supported in this browser/context. */
  readonly supported: boolean;
  /** Register the worker. Resolves with the registration (or null when unsupported/failed). */
  register(handlers: {
    onWaiting: () => void;
    onControlling: () => void;
    onRegisterError: (error: unknown) => void;
  }): Promise<ServiceWorkerRegistration | null>;
  /** Ask the browser to re-fetch sw.js and install it if it changed. */
  checkForUpdate(): Promise<void>;
  /** True when an installed worker is waiting to activate. */
  hasWaitingWorker(): boolean;
  /** Tell the waiting worker to activate (SKIP_WAITING). */
  activateWaiting(): Promise<void>;
  /** True when a worker currently controls this page. */
  isControlled(): boolean;
  /** Unregister every worker and wipe Cache Storage. Used only by the manual "Reset app" action. */
  hardReset(): Promise<void>;
}

export interface AppUpdateConfig {
  /** How often to poll `/version.json` while the tab is visible. */
  pollIntervalMs: number;
  /** Minimum gap between two version checks (visibility + interval + focus can stack). */
  minCheckGapMs: number;
  /** Time after page load during which a ready update is applied without asking. */
  launchWindowMs: number;
  /** Countdown shown on safe routes before auto-applying. */
  countdownMs: number;
  /** How long "Later" hides the prompt. */
  snoozeMs: number;
  /** How long to wait for the new worker to take control before declaring failure. */
  applyTimeoutMs: number;
  /** How long `downloading` may last before we surface manual controls. */
  downloadTimeoutMs: number;
}

export const DEFAULT_APP_UPDATE_CONFIG: AppUpdateConfig = {
  pollIntervalMs: 5 * 60 * 1000,
  minCheckGapMs: 20 * 1000,
  launchWindowMs: 6 * 1000,
  countdownMs: 10 * 1000,
  snoozeMs: 30 * 60 * 1000,
  applyTimeoutMs: 8 * 1000,
  downloadTimeoutMs: 90 * 1000,
};
