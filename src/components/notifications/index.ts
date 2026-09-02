/**
 * Notification Components
 * 
 * Export all notification-related components for easy importing.
 */

export { EnableNotificationsButton } from './EnableNotificationsButton';
export { PWAUpdatePrompt } from './PWAUpdatePrompt';
export { RequiredUpdatePrompt } from './RequiredUpdatePrompt';
export { PushNotificationPrompt } from './PushNotificationPrompt';
// WhatsNewOnboarding is intentionally NOT re-exported here: it pulls in
// ~75 KB (feature previews, phone mockup, confetti) and must stay a separate
// lazy chunk. Import it via `lazy(() => import('./WhatsNewOnboarding'))`.

