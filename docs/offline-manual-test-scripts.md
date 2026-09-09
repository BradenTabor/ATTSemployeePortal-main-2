# Offline Mode — Manual Test Scripts

These are critical-path test scripts to run before shipping offline mode to production. Each script should be run on iOS Safari (PWA mode) and Chrome on Android at minimum.

---

## Test 1: Offline Submit → Close App → Reopen → Sync

**Purpose:** Verify queued submissions survive app closure and sync on reopen.

**Steps:**
1. Sign in on the device.
2. Enable airplane mode (or disable Wi-Fi + cellular).
3. Navigate to the DVIR form.
4. Complete all fields, attach a photo (oil dipstick), and submit.
5. Verify: toast says "DVIR Saved Offline" and no error occurs.
6. Force-close the app (swipe away from app switcher).
7. Restore network connectivity.
8. Reopen the app.
9. Verify: the OfflineModeBanner shows "1 submission queued" briefly, then syncs.
10. Verify: the DVIR appears in admin view / history with the correct photo.

**Pass criteria:**
- Submission survives app closure.
- Photo uploads correctly after sync.
- No duplicate DVIRs created.

---

## Test 2: Session Expiry During Offline Period

**Purpose:** Verify the session refresh gate works and doesn't discard the queue.

**Steps:**
1. Sign in on the device.
2. Submit a JSA while online (to establish a baseline).
3. Enable airplane mode.
4. Submit a JSA offline.
5. Wait 2+ hours (or manually expire the session by clearing the Supabase auth token from localStorage, then restoring it without the refresh token).
6. Restore network connectivity.
7. Verify: the app attempts to sync, detects the expired session, and redirects to login with a message like "Your session expired while offline. Please sign in to sync your 1 pending submission."
8. Sign in.
9. Verify: the queued JSA syncs after login.

**Pass criteria:**
- Queue is NOT discarded on session expiry.
- User is prompted to re-authenticate.
- Submission syncs after re-login.

---

## Test 3: IndexedDB Unavailability (Incognito Mode)

**Purpose:** Verify graceful degradation when IndexedDB is unavailable.

**Steps:**
1. Open the app in a private/incognito browser window (or a browser that disables IDB in incognito).
2. Sign in.
3. Verify: a one-time notice appears indicating offline mode is unavailable.
4. Navigate to the DVIR form.
5. Enable airplane mode.
6. Attempt to submit.
7. Verify: the form blocks submission with a message like "This form requires an internet connection to submit."
8. Restore connectivity and submit normally.

**Pass criteria:**
- App detects IDB unavailability on init.
- Notice is shown once (not repeatedly).
- Forms fall back to online-only behavior.

---

## Test 4: Service Worker Update with Non-Empty Queue

**Purpose:** Verify the automatic update never reloads while queue has items (see `docs/APP_UPDATE_PIPELINE.md`).

**Steps:**
1. Deploy a new version of the app (or run the local deploy simulation from `docs/APP_UPDATE_PIPELINE.md`).
2. While there are queued offline submissions:
   a. The update banner appears ("Waiting for N pending submissions") with **Update now** / **Later**.
   b. No countdown starts; `__ATTS_UPDATE__.state().countdownEndsAt` is `null`.
   c. **Update now** still works (explicit user choice) — drafts and the queue persist in IndexedDB across the reload.
3. Go online and let the queue sync.
4. Verify: within ~5 s of the queue draining, the countdown starts (on a safe route) and the app reloads once with the new version, followed by the "Updated to version …" pill.

**Pass criteria:**
- No automatic reload while queue is non-empty.
- Automatic update proceeds after queue is cleared.
- No data loss during the update; exactly one reload.

---

## Test 5: Partial Sync / App Kill Mid-Sync

**Purpose:** Verify idempotent photo uploads handle interrupted syncs.

**Steps:**
1. Queue 3 DVIRs offline (each with photos).
2. Restore connectivity.
3. While syncing is in progress (watch the progress indicator), force-close the app.
4. Reopen the app.
5. Verify: the remaining unsynced DVIRs appear in the queue.
6. Verify: no duplicate records were created for any DVIRs that partially synced.
7. Let the sync complete.
8. Verify: all 3 DVIRs exist in the database with correct photos.

**Pass criteria:**
- Partially synced items are retried without duplication.
- Photo uploads use `upsert: true` so re-uploading doesn't 409.
- All photos are present after full sync completes.

---

## Device Matrix

| Device | Browser | PWA Mode | Priority |
|--------|---------|----------|----------|
| iPhone 13+ | Safari | Yes | P0 (primary field device) |
| iPhone SE | Safari | Yes | P1 |
| Samsung Galaxy | Chrome | Yes | P1 |
| iPad | Safari | Yes | P2 |
| Desktop | Chrome | No | P2 (admin testing) |

## Notes

- Each test should be run in PWA installed mode (Add to Home Screen), not just in-browser, since PWA mode has different IDB eviction behavior on iOS.
- For Test 2, if manual session expiry is difficult, shorten the Supabase refresh token lifetime to 5 minutes in project settings, run the test, then restore it.
- Tests 1 and 5 are the highest priority — they cover the most common real-world failure mode (field worker loses signal mid-day).
