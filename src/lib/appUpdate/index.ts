/**
 * App update pipeline — public entry point.
 *
 *   main.tsx            → startAppUpdates()          (registers SW, starts polling)
 *   useAppUpdate()      → useAppUpdateStore + controller actions
 *   AppUpdatePrompt.tsx → renders the state
 */

import { APP_VERSION, BUILD_TIME } from '../appVersion';
import { getQueueLength } from '../offlineQueue';
import { AppUpdateController } from './controller';
import { useAppUpdateStore } from './store';
import { createPwaServiceWorkerAdapter } from './swAdapter';
import type { AppUpdateState } from './types';

export { AppUpdateController } from './controller';
export type { ApplyTrigger, AppUpdateControllerDeps } from './controller';
export { useAppUpdateStore } from './store';
export { isAutoApplySafeRoute } from './safeRoutes';
export * from './types';

let controller: AppUpdateController | null = null;

/**
 * Read-only diagnostics for support + E2E: `window.__ATTS_UPDATE__.state()`
 * in the console tells you exactly what the update pipeline thinks.
 */
interface AppUpdateDiagnostics {
  version: string;
  buildTime: string;
  state: () => AppUpdateState;
  store: typeof useAppUpdateStore;
  checkForUpdates: () => Promise<void>;
}

declare global {
  interface Window {
    __ATTS_UPDATE__?: AppUpdateDiagnostics;
  }
}

/** Create (once) and start the production controller. Safe to call repeatedly. */
export function startAppUpdates(): AppUpdateController {
  if (!controller) {
    controller = new AppUpdateController({
      adapter: createPwaServiceWorkerAdapter(),
      localVersion: APP_VERSION,
      localBuildTime: BUILD_TIME,
      getQueueLength,
    });
    if (typeof window !== 'undefined') {
      const running = controller;
      window.__ATTS_UPDATE__ = {
        version: APP_VERSION,
        buildTime: BUILD_TIME,
        state: () => useAppUpdateStore.getState(),
        store: useAppUpdateStore,
        checkForUpdates: () => running.checkForUpdates(),
      };
    }
  }
  controller.start();
  return controller;
}

/** The running controller, or null before `startAppUpdates()`. */
export function getAppUpdateController(): AppUpdateController | null {
  return controller;
}
