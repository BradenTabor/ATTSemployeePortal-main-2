/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
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

// DO NOT skip waiting on install — wait for the client's SKIP_WAITING message.
// The page-side AppUpdateController (src/lib/appUpdate) decides WHEN the new
// worker activates: silently at launch, after a short countdown on a safe
// route, or when the user taps "Update now". It reloads the page only after
// `controllerchange`, so a reload always lands on this worker's precached shell.

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

// 4. Same-origin decorative imagery (nav-card art under /assets/*.webp) is
//    excluded from the install precache to keep first-launch download small;
//    it is cached the first time it renders. Fonts are self-hosted under
//    /fonts and precached, so no Google Fonts routes are needed.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    request.destination === 'image' &&
    url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'app-images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// 4b. Same-origin build assets that are deliberately left out of the install
//     precache (heavy PDF/XLSX/maps vendor chunks — see vite.config.ts
//     `globIgnores`). File names are content-hashed, so CacheFirst is safe and
//     the chunk is cached the first time a user actually exports/prints.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/assets/') &&
    (request.destination === 'script' || request.destination === 'style' || url.pathname.endsWith('.js')),
  new CacheFirst({
    cacheName: 'lazy-assets-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// 5. Navigation — always serve THIS worker's precached index.html (app-shell model).
//    The shell and the hashed assets it references then come from the same build,
//    so a page can never load a new index.html against an old precache (or vice
//    versa). New builds reach the user only through the update pipeline: the new
//    worker installs, waits, and the page reloads once it has taken control.
//    Deep links (/forms/jsa) work offline for the same reason. Non-HTML paths that
//    happen to be navigations (direct hits on sw.js, version.json, files with an
//    extension) fall through to the network.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [
      /^\/(sw|dev-sw)\.js/,
      /^\/version\.json$/,
      /^\/manifest\.json$/,
      /^\/api\//,
      /\/[^/?]+\.[^/?]+$/,
    ],
  }),
);

// ============================================
// Push Notification Handler (iOS Safari Compatible)
// ============================================
self.addEventListener('push', (event: PushEvent) => {
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
  event.notification.close();

  // Handle "dismiss" action explicitly - don't open app
  if (event.action === 'dismiss') {
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
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
          return client.focus();
        }
      }

      // Open new window if not found
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============================================
// Notification Close Handler (for analytics)
// ============================================
self.addEventListener('notificationclose', () => {
  // Could send analytics here if needed
});

// ============================================
// Message Handler (for app communication)
// ============================================
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      // Sent by AppUpdateController once it is safe to swap builds (offline
      // queue drained, user idle / consented). Activation → clientsClaim →
      // `controllerchange` on the page → single reload onto the new shell.
      self.skipWaiting();
      break;
  }
});
