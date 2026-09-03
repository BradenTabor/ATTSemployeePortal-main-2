import { create } from 'zustand';
import type { AppUpdateState } from './types';

export const INITIAL_APP_UPDATE_STATE: AppUpdateState = {
  status: 'idle',
  reason: null,
  targetVersion: null,
  targetBuildTime: null,
  readyAt: null,
  snoozedUntil: null,
  countdownEndsAt: null,
  countdownSecondsLeft: null,
  pendingQueueCount: 0,
  blocking: false,
  error: null,
  lastCheckedAt: null,
  appliedUpdate: null,
};

interface AppUpdateStore extends AppUpdateState {
  patch: (partial: Partial<AppUpdateState>) => void;
  reset: () => void;
}

/**
 * Observable update state. Written only by `AppUpdateController`; read by
 * `useAppUpdate` / `AppUpdatePrompt`. Kept outside React so the controller can
 * run from `main.tsx` before the tree mounts.
 */
export const useAppUpdateStore = create<AppUpdateStore>()((set) => ({
  ...INITIAL_APP_UPDATE_STATE,
  patch: (partial) => set(partial),
  reset: () => set(INITIAL_APP_UPDATE_STATE),
}));
