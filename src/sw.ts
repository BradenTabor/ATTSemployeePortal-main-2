/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// Extended NotificationOptions for iOS Safari compatibility
// TypeScript's built-in type is missing some Web Notification API properties
interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
  renotify?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

// ============================================
// Precaching (static assets from Vite build)
// ============================================
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// DO NOT skip waiting on install - wait for client signal.
// This allows RequiredUpdatePrompt to appear and user to control the update.
// SKIP_WAITING is triggered by the message handler below when user clicks "Update Now".
// Queue-aware: if offline queue is non-empty, defer the update (see message handler).

// ============================================
// Runtime Caching Strategies
// ============================================

// 1. Supabase REST API — NetworkFirst with 24h cache fallback
//    Matches GET requests to the Supabase REST endpoint (e.g. /rest/v1/announcements)
//    Only caches successful responses (200). Auth-mutating requests (POST/PATCH/DELETE)
//    are not intercepted.
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/rest/v1/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'supabase-api-cache',
    networkTimeoutSeconds: 8,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  }),
);

// 2. Supabase Storage (photos, avatars, signed URLs) — CacheFirst with 7-day expiry
//    Matches requests to /storage/v1/object/ (public and signed URLs).
//    Photos rarely change once uploaded, so cache-first is appropriate.
registerRoute(
  ({ url }) => url.pathname.startsWith('/storage/v1/object/'),
  new CacheFirst({
    cacheName: 'supabase-storage-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  }),
);

// 3. Supabase Auth endpoints — NetworkOnly (never cache auth)
//    Auth is handled by the Supabase SDK and tokens are in localStorage.
//    We explicitly do NOT cache /auth/v1/ to prevent stale session issues.
//    (No registerRoute needed — NetworkOnly is the default for unmatched routes.)

// 4. Google Fonts — StaleWhileRevalidate for CSS, CacheFirst for font files
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  }),
);

// 5. Navigation fallback — serve cached index.html for all navigation requests (SPA)
//    This ensures the app shell loads offline even for deep-link routes like /forms/jsa
const navigationHandler = new NetworkFirst({
  cacheName: 'navigation-cache',
  networkTimeoutSeconds: 4,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});

registerRoute(new NavigationRoute(navigationHandler));

// ============================================
// Push Notification Handler (iOS Safari Compatible)
// ============================================
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push received:', event);

  if (!event.data) {
    console.warn('[SW] Push event has no data');
    return;
  }

  try {
    const payload = event.data.json();
    const { title, body, url, data } = payload;

    // Determine if this is a high-priority notification
    const isHighPriority = data?.severity === 'critical' || data?.severity === 'high';

    // iOS-OPTIMIZED notification options for lock screen delivery
    const notificationOptions: ExtendedNotificationOptions = {
      body: body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data?.category || 'default',
      
      // Keep high-priority notifications visible until user interacts
      requireInteraction: isHighPriority,
      
      // CRITICAL FOR iOS: Must be false for sound to play
      silent: false,
      
      // Vibration pattern for mobile devices (iOS supports in PWA mode)
      vibrate: isHighPriority ? [200, 100, 200, 100, 200] : [200, 100, 200],
      
      // Allow re-notification for same tag (updates)
      renotify: true,
      
      // iOS action buttons (shown on lock screen)
      actions: [
        {
          action: 'open',
          title: 'Open',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        },
      ],
      
      // Data payload for click handling
      data: {
        url: url || '/dashboard',
        notificationId: data?.notificationId,
        category: data?.category,
        severity: data?.severity,
        timestamp: Date.now(),
      },
    };

    event.waitUntil(
      self.registration.showNotification(title || 'ATTS Portal', notificationOptions)
    );
    
    console.log('[SW] Notification shown:', title, 'Severity:', data?.severity);
  } catch (error) {
    console.error('[SW] Failed to parse push payload:', error);
    
    // Fallback: show raw text if JSON parse fails
    const text = event.data?.text() || 'New notification';
    event.waitUntil(
      self.registration.showNotification('ATTS Portal', { 
        body: text,
        icon: '/icon-192.png',
        silent: false,
      })
    );
  }
});

// ============================================
// Notification Click Handler (iOS Compatible)
// ============================================
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification clicked:', event.notification.tag, 'Action:', event.action);

  event.notification.close();

  // Handle "dismiss" action explicitly - don't open app
  if (event.action === 'dismiss') {
    console.log('[SW] Notification dismissed by user');
    return;
  }

  // Handle "open" action or default click (no action specified)
  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if app is already open in a window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate existing window to the URL and focus it
          console.log('[SW] Focusing existing window');
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
          return client.focus();
        }
      }

      // Open new window if not found
      if (self.clients.openWindow) {
        console.log('[SW] Opening new window:', urlToOpen);
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============================================
// Notification Close Handler (for analytics)
// ============================================
self.addEventListener('notificationclose', (event: NotificationEvent) => {
  console.log('[SW] Notification closed without interaction:', event.notification.tag);
  // Could send analytics here if needed
});

// ============================================
// Message Handler (for app communication)
// ============================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CHECK_QUEUE_EMPTY':
      // The main thread asks if it's safe to update. We respond with whatever
      // the client told us (we can't check IDB from here — the main thread
      // checks the queue length and sends the result).
      // This is a coordination handshake: the client checks queue, then
      // either sends SKIP_WAITING or defers.
      if (event.source && 'postMessage' in event.source) {
        (event.source as Client).postMessage({
          type: 'QUEUE_CHECK_RESPONSE',
          // Acknowledge the check — the client drives the decision
        });
      }
      break;
  }
});
