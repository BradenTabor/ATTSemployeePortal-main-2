/**
 * Renders notification/prompt overlays that are lazy-loaded to keep main bundle under size limit.
 * Must be mounted inside Router so WhatsNewOnboarding has route context.
 */
import {
  RequiredUpdatePrompt,
  PushNotificationPrompt,
  WhatsNewOnboarding,
} from "./notifications";

export default function AppNotificationShell() {
  return (
    <>
      <WhatsNewOnboarding />
      <RequiredUpdatePrompt required={true} />
      <PushNotificationPrompt />
    </>
  );
}
