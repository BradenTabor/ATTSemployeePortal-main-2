import { BrowserRouter as Router } from "react-router-dom";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Suspense, lazy, useEffect, useMemo } from "react";
import { Toaster } from "./components/ui/Toaster";
import { ToastOverlayProvider } from "./components/ui/ToastOverlay";
// Lazy-loaded to keep main-index bundle under size limit
const AppNotificationShell = lazy(() => import("./components/AppNotificationShell"));
const DeployVersionChecker = lazy(() => import("./components/DeployVersionChecker").then((m) => ({ default: m.DeployVersionChecker })));
const IOSInstallPrompt = lazy(() => import("./components/pwa").then((m) => ({ default: m.IOSInstallPrompt })));
// Admin/granted-only floating "Award" entry + modal — most users never render it.
const ManualAwardsGlobalEntry = lazy(() =>
  import("./components/manual-awards/ManualAwardsShell").then((m) => ({ default: m.ManualAwardsGlobalEntry }))
);
import { queryClient } from "./lib/queryClient";
import { createIDBPersister, shouldDehydrateQuery, PERSISTER_MAX_AGE_MS } from "./lib/queryPersister";
import { OfflineQueueProvider } from "./contexts/OfflineQueueContext";
import { RewardCelebrationProvider } from "./contexts/RewardCelebrationContext";
import { GamificationCelebrationProvider } from "./contexts/GamificationCelebrationContext";
import { AppCelebrations } from "./components/AppCelebrations";
import { OfflineSyncIndicator } from "./components/OfflineSyncIndicator";
import { Understory } from "./components/canopy/Understory";
import { useAuth } from "./contexts/AuthContext";
import { installLinkPrefetch, prefetchRoutesForRole } from "./routes/routePrefetch";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AnimatedRoutes } from "@/routes";
// Lazy-load devtools to reduce bundle size in production
const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then(mod => ({
    default: mod.ReactQueryDevtools
  }))
);

/**
 * Warm the chunks the signed-in role is most likely to open next (plus the
 * Emergency Action Plan, always) once the browser is idle. Runs again if the
 * role changes (sign-in), never on slow/data-saver connections.
 *
 * Signed-out visitors get nothing: the login page must not spend the radio on
 * ~60 dashboard chunks the visitor may never reach. The effect re-runs the
 * moment sign-in resolves a user/role.
 */
function useIdleRoutePrefetch() {
  const { user, role, loading } = useAuth();
  useEffect(() => {
    if (loading || !user) return;
    const run = () => prefetchRoutesForRole(role);
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(run, 1200);
    return () => clearTimeout(id);
  }, [user, role, loading]);
}

/** Hover / touch / focus on any internal link warms its route chunk (one delegated listener). */
function useLinkPrefetch() {
  useEffect(() => installLinkPrefetch(), []);
}

/**
 * The floating "Award points" entry is gated on a per-user grant that only a
 * signed-in user can hold, so signed-out visitors never fetch its chunk (which
 * also drags in the shared hooks + Google Maps loader chunk, ~75 KB).
 */
function SignedInManualAwardsEntry() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Suspense fallback={null}>
      <ManualAwardsGlobalEntry />
    </Suspense>
  );
}

export default function App() {
  useIdleRoutePrefetch();
  useLinkPrefetch();

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
      {/*
        The CANOPY atmosphere lives at the app shell so the WebGL context and
        shader program are created once, not on every route change. The app
        content sits in its own stacking layer above it so non-positioned page
        roots can never be painted underneath the fixed canvas.
      */}
      <Understory fixed className="z-0" />
      <div className="relative z-[1]">
      <ToastOverlayProvider>
        <OfflineQueueProvider>
          <RewardCelebrationProvider>
            <GamificationCelebrationProvider>
            <OfflineSyncIndicator />
            <Router>
              <AnimatedRoutes />
              {/* Notifications/onboarding (lazy-loaded for bundle size) — needs Router context */}
              <Suspense fallback={null}>
                <AppNotificationShell />
              </Suspense>
            </Router>
            <AppCelebrations />
            <SignedInManualAwardsEntry />
            </GamificationCelebrationProvider>
          </RewardCelebrationProvider>
        </OfflineQueueProvider>
        {/* Corner toasts for non-form notifications */}
        <Toaster />
        {/* Deploy version check + prompts (lazy-loaded for bundle size) */}
        <Suspense fallback={null}>
          <DeployVersionChecker />
          <IOSInstallPrompt />
        </Suspense>
        {/* DevTools - dev only and opt-in (VITE_QUERY_DEVTOOLS=true); its floating toggle collides with the Award dock */}
        {import.meta.env.DEV && import.meta.env.VITE_QUERY_DEVTOOLS === "true" && (
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
      </div>
    </PersistQueryClientProvider>
  );
}
