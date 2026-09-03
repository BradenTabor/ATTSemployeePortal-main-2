import { useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAppUpdateController, useAppUpdateStore, type AppUpdateState } from '@/lib/appUpdate';

export interface UseAppUpdateResult extends AppUpdateState {
  /** Prompt should be visible (ready/downloading/applying/failed and not snoozed, or blocking). */
  visible: boolean;
  applyNow: () => void;
  snooze: () => void;
  hardReset: () => void;
  acknowledgeApplied: () => void;
}

/**
 * React view of the update pipeline. Must be rendered inside the Router so the
 * controller learns which route is active (forms pause the auto-countdown).
 * All timing (countdown ticks, snooze expiry) is driven by the controller so
 * this hook stays pure.
 */
export function useAppUpdate(): UseAppUpdateResult {
  const state = useAppUpdateStore();
  const { pathname } = useLocation();

  useEffect(() => {
    getAppUpdateController()?.setRoute(pathname);
  }, [pathname]);

  const applyNow = useCallback(() => {
    void getAppUpdateController()?.applyNow();
  }, []);
  const snooze = useCallback(() => getAppUpdateController()?.snooze(), []);
  const hardReset = useCallback(() => {
    void getAppUpdateController()?.hardReset();
  }, []);
  const acknowledgeApplied = useCallback(() => getAppUpdateController()?.acknowledgeApplied(), []);

  const snoozed = state.snoozedUntil !== null;
  const visible =
    state.blocking ||
    state.status === 'failed' ||
    ((state.status === 'ready' || state.status === 'downloading' || state.status === 'applying') && !snoozed);

  return { ...state, visible, applyNow, snooze, hardReset, acknowledgeApplied };
}
