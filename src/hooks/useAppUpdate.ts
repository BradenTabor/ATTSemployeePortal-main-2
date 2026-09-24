import { useEffect, useRef, useState } from 'react';
import { createAppUpdateManager, type AppUpdateState } from '../lib/appUpdateManager';

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({ available: false, updating: false, error: null });
  const manager = useRef<ReturnType<typeof createAppUpdateManager> | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const updates = createAppUpdateManager(navigator.serviceWorker, setState, () => window.location.reload());
    manager.current = updates;
    void updates.start(import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js', {
      type: import.meta.env.DEV ? 'module' : 'classic',
      scope: '/',
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void updates.check();
    };
    const onOnline = () => void updates.check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const timer = setInterval(onVisible, 2 * 60 * 1000);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      updates.dispose();
      manager.current = null;
    };
  }, []);
  return { ...state, applyUpdate: () => manager.current?.apply() };
}
