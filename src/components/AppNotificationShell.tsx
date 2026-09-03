/**
 * Renders notification/prompt overlays that are lazy-loaded to keep main bundle under size limit.
 * Must be mounted inside Router so WhatsNewOnboarding and AppUpdatePrompt have route context.
 */
import { lazy, Suspense } from "react";
import { AppUpdatePrompt } from "./notifications/AppUpdatePrompt";
import { useAuth } from "../contexts/AuthContext";
import { shouldShowOnboarding } from "../lib/appVersion";

// ~140 KB (feature previews, phone mockup, confetti). Only fetched when the
// signed-in user has not yet seen this version's What's New.
const WhatsNewOnboarding = lazy(() =>
  import("./notifications/WhatsNewOnboarding").then((m) => ({ default: m.WhatsNewOnboarding }))
);

// Push opt-in only makes sense for a signed-in user; keep its ~20 KB (prompt +
// push hook + shared helpers) off the login page's critical path.
const PushNotificationPrompt = lazy(() =>
  import("./notifications/PushNotificationPrompt").then((m) => ({ default: m.PushNotificationPrompt }))
);

export default function AppNotificationShell() {
  const { user } = useAuth();
  const showWhatsNew = !!user && shouldShowOnboarding();

  return (
    <>
      {showWhatsNew && (
        <Suspense fallback={null}>
          <WhatsNewOnboarding />
        </Suspense>
      )}
      <AppUpdatePrompt />
      {user && (
        <Suspense fallback={null}>
          <PushNotificationPrompt />
        </Suspense>
      )}
    </>
  );
}
