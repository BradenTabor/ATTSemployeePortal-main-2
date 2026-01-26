import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  checkForNewDeploy,
  forceReloadForNewDeploy,
  clearReloadAttempts,
} from '../lib/checkDeployVersion';

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const RELOAD_DELAY_MS = 3000;

/**
 * Checks for new deploys on mount, when tab becomes visible, and every 2 minutes.
 * On new deploy: shows a short toast then forces reload after 3 seconds.
 */
export function DeployVersionChecker() {
  const isCheckingRef = useRef(false);

  useEffect(() => {
    clearReloadAttempts();

    const checkAndReload = async () => {
      if (isCheckingRef.current) return;
      isCheckingRef.current = true;
      try {
        const hasNewDeploy = await checkForNewDeploy();
        if (hasNewDeploy) {
          toast.info('New version available. Updating in 3 seconds…', {
            duration: RELOAD_DELAY_MS,
          });
          setTimeout(() => forceReloadForNewDeploy(), RELOAD_DELAY_MS);
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    checkAndReload();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkAndReload();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = setInterval(checkAndReload, POLL_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  return null;
}
