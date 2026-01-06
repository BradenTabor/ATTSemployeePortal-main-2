# iOS Safari Push Notification Testing Guide

This guide covers testing push notifications on iOS Safari, which has specific requirements different from desktop browsers.

## Prerequisites

- **iPhone/iPad running iOS 16.4 or later**
  - Check: Settings → General → About → iOS Version
  - Push notifications require iOS 16.4+
- **Safari browser** (not Chrome or Firefox on iOS)
- **HTTPS deployment** (production URL)
  - localhost does NOT work for iOS push
  - Use production URL or ngrok for testing

## Critical iOS Requirements

| Requirement | Desktop Chrome | iOS Safari (Browser) | iOS Safari (PWA) |
|-------------|----------------|---------------------|------------------|
| HTTPS | Required | Required | Required |
| Installation | Not required | **N/A - Push NOT supported** | **Required** |
| Push Notifications | ✅ Works | ❌ Not Supported | ✅ Works |
| Lock Screen Alerts | N/A | ❌ No | ✅ Yes |
| Sound/Vibration | Limited | ❌ No | ✅ Yes |
| Background Delivery | Yes | ❌ No | ✅ Yes |

**Key Takeaway**: iOS Safari browser tabs do NOT support push notifications. Users MUST install the PWA to their home screen.

---

## Installation Steps

### Step 1: Install PWA to Home Screen

1. Open **Safari** on iPhone (not Chrome/Firefox)
2. Navigate to production URL (e.g., `https://atts-portal.vercel.app`)
3. Tap the **Share button** (square with arrow pointing up) at bottom of screen
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"** in top right corner
6. ✅ App icon should appear on home screen

### Step 2: Open PWA and Enable Notifications

1. **Tap the app icon on home screen** (NOT Safari browser)
2. App should open in **standalone mode** (no Safari UI bars)
3. Navigate to your dashboard
4. Tap **"Enable Notifications"** button
5. iOS system permission prompt appears
6. Tap **"Allow"**
7. ✅ Button should change to "Notifications Enabled ✓"

### Step 3: Send Test Notification

1. In admin panel (desktop or another device), send a test notification
2. **Lock your iPhone** (press side button)
3. ✅ Notification should appear on lock screen within 1-5 seconds
4. ✅ iPhone should vibrate and play notification sound
5. ✅ Notification shows correct title, body, and app icon

### Step 4: Test Notification Click

1. Tap the notification on lock screen
2. ✅ PWA should open to the specified URL
3. ✅ If app was already open in background, it should focus/navigate

### Step 5: Test Background Delivery

1. Close the PWA completely (swipe up from app switcher)
2. Lock iPhone
3. Send another test notification
4. ✅ Notification should still appear on lock screen
5. ✅ Sound and vibration should work

---

## Troubleshooting

### "Add to Home Screen" option not showing in Safari

**Causes:**
- Missing iOS meta tags in `index.html`
- Not using Safari (Chrome/Firefox don't support PWA install on iOS)

**Fixes:**
1. Run `npm run verify:ios` to check configuration
2. Verify `apple-mobile-web-app-capable` meta tag exists in `index.html`
3. Make sure you're using Safari, not Chrome or Firefox

### Notifications not appearing on lock screen

**Checklist:**
- [ ] Did you install to home screen? (Required for iOS)
- [ ] Did you open from home screen (not Safari browser)?
- [ ] Is notification permission granted?
  - Check: Settings → ATTS Portal → Notifications
- [ ] Is Do Not Disturb enabled? (Disable in Control Center)
- [ ] Is Focus mode blocking notifications?
- [ ] Is site deployed with HTTPS? (http:// won't work)
- [ ] Is iPhone running iOS 16.4+?
  - Check: Settings → General → About → iOS Version

### No sound or vibration

**Checklist:**
- [ ] Check Settings → Sounds & Haptics → Ringer and Alerts volume
- [ ] Check silent mode switch on side of iPhone (should be OFF for sound)
- [ ] Verify service worker sets `silent: false` in `src/sw.ts`
- [ ] Check if app has sound permissions in Settings

### Permission prompt not showing

**Cause:** iOS only prompts for notification permission ONCE per app.

**Fixes:**
- If denied, go to Settings → ATTS Portal → Notifications → Allow Notifications
- To reset: Uninstall PWA (hold icon → Remove App) and reinstall

### App crashes or won't open after installation

**Causes:**
- Service worker error
- Manifest configuration issue

**Fixes:**
1. Check browser console (Safari → Develop → [device] → [app] → Console)
2. Run `npm run verify:ios` to check configuration
3. Rebuild and redeploy: `npm run build`

---

## Using Safari Web Inspector

To debug the PWA on a real iPhone:

1. **On iPhone**: Settings → Safari → Advanced → Web Inspector → ON
2. **On Mac**: Safari → Preferences → Advanced → Show Develop menu
3. Connect iPhone to Mac via USB
4. Open the PWA on iPhone
5. On Mac: Safari → Develop → [Your iPhone] → [ATTS Portal]
6. Use Console tab to see service worker logs

---

## Verification Script

Before deploying, run the verification script to check all iOS requirements:

```bash
npm run verify:ios
```

This checks:
- iOS meta tags in `index.html`
- Required assets (`apple-touch-icon.png`, `badge-96.png`, etc.)
- Manifest configuration (`display: "standalone"`)
- Service worker iOS options (`silent: false`, actions, etc.)
- iOS detection in `usePushNotifications` hook
- `IOSInstallPrompt` component

---

## Production Checklist

Before deploying iOS push to production:

### Infrastructure
- [ ] All iOS meta tags added to `index.html`
- [ ] Manifest has `display: "standalone"`
- [ ] Apple touch icon exists (`/public/apple-touch-icon.png`)
- [ ] Badge icon exists (`/public/badge-96.png`)
- [ ] Deployed to HTTPS URL

### Service Worker
- [ ] Sets `silent: false` (enables sound)
- [ ] Includes vibration pattern
- [ ] Has notification actions (Open/Dismiss)
- [ ] Handles dismiss action correctly

### React Components
- [ ] `usePushNotifications` hook detects iOS and installation status
- [ ] `EnableNotificationsButton` shows iOS installation instructions
- [ ] `IOSInstallPrompt` shows installation steps

### Testing
- [ ] `npm run verify:ios` passes
- [ ] Tested on real iPhone (not simulator)
- [ ] Notifications appear on lock screen
- [ ] Sound and vibration work
- [ ] Clicking notification opens app
- [ ] Background delivery works

---

## Known iOS Limitations

1. **Installation Required**
   - Push notifications do NOT work in Safari browser tab
   - Users MUST install the PWA to their home screen

2. **HTTPS Only**
   - iOS Safari requires HTTPS even for testing
   - Use production URL or ngrok for local testing

3. **One Permission Prompt**
   - iOS only prompts for notification permission ONCE
   - If denied, user must manually enable in Settings

4. **No Simulator Support**
   - iOS Simulator does NOT support push notifications
   - Must test on real iPhone/iPad

5. **iOS 16.4+ Required**
   - Web Push is only supported on iOS 16.4 and later
   - Earlier versions will show "iOS Update Required" message

6. **Battery Considerations**
   - Excessive notifications can drain battery
   - Respect user preferences and quiet hours

---

## Success Metrics

Track these metrics for iOS users:

| Metric | Target |
|--------|--------|
| Installation Rate | >40% of iOS visitors install PWA |
| Permission Grant Rate | >60% of installed users enable push |
| Notification Delivery Rate | >95% of sent notifications reach device |
| Click-Through Rate | >30% of notifications clicked |

---

## Quick Reference

### iOS Detection in Code

```typescript
// In usePushNotifications hook
const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
const iOSVersion = parseFloat(navigator.userAgent.match(/OS (\d+)_(\d+)/)?.[1] + '.' + navigator.userAgent.match(/OS (\d+)_(\d+)/)?.[2]);
```

### Service Worker iOS Options

```typescript
const notificationOptions = {
  silent: false,           // CRITICAL for sound
  vibrate: [200, 100, 200], // Vibration pattern
  renotify: true,          // Allow re-notification
  actions: [               // Action buttons
    { action: 'open', title: 'Open' },
    { action: 'dismiss', title: 'Dismiss' }
  ]
};
```

### Required Meta Tags

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="ATTS Portal" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

---

## Support

If iOS push still doesn't work after following this guide:

1. Run `npm run verify:ios` and fix any errors
2. Check service worker logs (Safari Web Inspector)
3. Check Supabase Edge Function logs for dispatch errors
4. Test on multiple iOS versions (16.4, 17.0, 17.4+)
5. Create issue with:
   - iOS version
   - Service worker console logs
   - Edge Function logs
   - Screenshots of issue


