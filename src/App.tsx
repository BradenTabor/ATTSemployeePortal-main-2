import { BrowserRouter as Router } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Suspense, lazy, useEffect, useMemo } from "react";
import { Toaster } from "./components/ui/Toaster";
import { ToastOverlayProvider } from "./components/ui/ToastOverlay";
// Lazy-loaded to keep main-index bundle under size limit
const AppNotificationShell = lazy(() => import("./components/AppNotificationShell"));
const DeployVersionChecker = lazy(() => import("./components/DeployVersionChecker").then((m) => ({ default: m.DeployVersionChecker })));
const IOSInstallPrompt = lazy(() => import("./components/pwa").then((m) => ({ default: m.IOSInstallPrompt })));
import { queryClient } from "./lib/queryClient";
import { createIDBPersister, shouldDehydrateQuery, PERSISTER_MAX_AGE_MS } from "./lib/queryPersister";
import { OfflineQueueProvider } from "./contexts/OfflineQueueContext";
import { RewardCelebrationProvider } from "./contexts/RewardCelebrationContext";
import { RewardPointsCelebration } from "./components/rewards/RewardPointsCelebration";
import { ManualAwardsGlobalEntry } from "./components/manual-awards/ManualAwardsShell";
import { OfflineSyncIndicator } from "./components/OfflineSyncIndicator";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AnimatedRoutes } from "@/routes";
// Lazy-load devtools to reduce bundle size in production
const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then(mod => ({
    default: mod.ReactQueryDevtools
  }))
);

/** Preload critical route chunks after first paint (PERF-6) so navigation feels instant. */
function usePreloadCriticalChunks() {
  useEffect(() => {
    const preload = () => {
      void import("./pages/Dashboard");
      void import("./pages/Home");
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(preload);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(preload, 0);
    return () => clearTimeout(id);
  }, []);
}

export default function App() {
  usePreloadCriticalChunks();

  // Memoize persister + options so they don't change on re-render
  const persistOptions = useMemo(() => ({
    persister: createIDBPersister(),
    maxAge: PERSISTER_MAX_AGE_MS,
    dehydrateOptions: {
      shouldDehydrateQuery,
    },
  }), []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <ToastOverlayProvider>
        <OfflineQueueProvider>
          <RewardCelebrationProvider>
            <OfflineSyncIndicator />
            <Router>
              <AnimatedRoutes />
              {/* Notifications/onboarding (lazy-loaded for bundle size) — needs Router context */}
              <Suspense fallback={null}>
                <AppNotificationShell />
              </Suspense>
            </Router>
            <RewardPointsCelebration />
            <ManualAwardsGlobalEntry />
          </RewardCelebrationProvider>
        </OfflineQueueProvider>
        {/* Corner toasts for non-form notifications */}
        <Toaster />
        {/* Deploy version check + prompts (lazy-loaded for bundle size) */}
        <Suspense fallback={null}>
          <DeployVersionChecker />
          <IOSInstallPrompt />
        </Suspense>
        {/* DevTools - only renders in development, lazy-loaded to reduce bundle */}
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtools
              initialIsOpen={false}
              position="bottom"
              buttonPosition="bottom-right"
            />
          </Suspense>
        )}
        <SpeedInsights />
      </ToastOverlayProvider>
    </PersistQueryClientProvider>
  );
}
