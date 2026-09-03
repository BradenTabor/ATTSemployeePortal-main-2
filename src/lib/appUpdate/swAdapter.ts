/**
 * Real-browser implementation of `ServiceWorkerAdapter` on top of
 * `virtual:pwa-register` (vite-plugin-pwa, `registerType: 'prompt'`).
 *
 * The plugin already:
 *   - resolves the correct SW URL/type for dev (`/dev-sw.js?dev-sw`, module)
 *     and prod (`/sw.js`, classic)
 *   - calls `onNeedRefresh` when a new worker reaches `waiting`
 *   - reloads the page once the new worker takes control after SKIP_WAITING
 *
 * Everything else (polling, policy, loop guard, UI) lives in the controller.
 */

import { registerSW } from 'virtual:pwa-register';
import type { ServiceWorkerAdapter } from './types';

export function createPwaServiceWorkerAdapter(): ServiceWorkerAdapter {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  let registration: ServiceWorkerRegistration | null = null;
  let sendSkipWaiting: ((reloadPage?: boolean) => Promise<void>) | null = null;

  return {
    supported,

    register({ onWaiting, onControlling, onRegisterError }) {
      if (!supported) return Promise.resolve(null);

      return new Promise((resolve) => {
        let settled = false;
        const settle = (reg: ServiceWorkerRegistration | null) => {
          if (settled) return;
          settled = true;
          resolve(reg);
        };

        navigator.serviceWorker.addEventListener('controllerchange', onControlling);

        sendSkipWaiting = registerSW({
          immediate: true,
          onNeedRefresh: onWaiting,
          onRegisteredSW(_swUrl, reg) {
            registration = reg ?? null;
            settle(registration);
          },
          onRegisterError(error) {
            onRegisterError(error);
            settle(null);
          },
        });

        // registerSW resolves silently when the browser has no SW support at
        // runtime (or the module import is blocked); never leave callers hanging.
        setTimeout(() => settle(registration), 15_000);
      });
    },

    async checkForUpdate() {
      if (!registration) return;
      try {
        await registration.update();
      } catch {
        // Offline or transient network failure; the next poll retries.
      }
    },

    hasWaitingWorker() {
      return !!registration?.waiting;
    },

    async activateWaiting() {
      const waiting = registration?.waiting;
      if (waiting) {
        waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      await sendSkipWaiting?.(true);
    },

    isControlled() {
      return supported && !!navigator.serviceWorker.controller;
    },

    async hardReset() {
      if (supported) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    },
  };
}
