# App Update Pipeline

How a deploy reaches a phone that already has the ATTS Portal open or installed, and why it can no longer reload-loop.

## The incident this replaces

After a deploy, the installed PWA kept serving the previous build from the service worker's precache. Two independent mechanisms then fought over the page:

- `DeployVersionChecker` polled `/version.json`, saw a newer `buildTime`, showed a countdown and called `window.location.reload()`. The reload came back from the same (old) worker, the poll disagreed again, and the loop repeated every few seconds. Its loop guard reset itself on every mount, so it never tripped.
- `RequiredUpdatePrompt` (service-worker `waiting`) showed a full-screen mandatory modal at the same time.

Result: countdown + reload spam, sign-in impossible. Compounding it, `vercel.json` header order let a catch-all `no-cache` rule override immutable caching for hashed assets.

## Architecture

One controller decides when the app updates. The UI only renders its state.

```
src/lib/appUpdate/
  controller.ts   AppUpdateController — state machine + policy (the only place that reloads)
  store.ts        Zustand store: AppUpdateState (status, countdown, queue count, error, appliedUpdate)
  reloadGuard.ts  sessionStorage guard: 1 automatic reload per target build, max 2 per 10 min
  versionCheck.ts fetch + validate /version.json (no-store, cache-busted), compare by buildTime
  safeRoutes.ts   which routes tolerate an automatic reload
  swAdapter.ts    thin wrapper over virtual:pwa-register + navigator.serviceWorker
  types.ts        AppUpdateState / AppUpdateConfig / DEFAULT_APP_UPDATE_CONFIG
  index.ts        startAppUpdates(), window.__ATTS_UPDATE__ diagnostics
src/init/app-update-init.ts           started from main.tsx before React renders
src/hooks/useAppUpdate.ts             React view of the store + actions; syncs the route
src/components/notifications/AppUpdatePrompt.tsx  banner / blocking overlay / "Updated" pill
src/sw.ts                             precached app shell (createHandlerBoundToURL) + SKIP_WAITING
```

### Signals in

| Signal | Meaning | Resulting status |
|---|---|---|
| `/version.json.buildTime !== BUILD_TIME` | server has a newer build | `downloading` → asks the browser to fetch `sw.js` (`registration.update()`) |
| service worker `waiting` | new build installed, not yet controlling | `ready` |
| `vite:preloadError` | a lazy chunk 404'd (stale deploy) | re-check, then `blocking` |
| `/version.json` matches | we are current | `idle`, reload budget reset |

The version poll runs at start, on `focus`, `visibilitychange`, `online`, and every 5 minutes (20 s minimum gap). A failed or malformed fetch is "unknown", never "new version".

### Policy (`evaluatePolicy`)

| Situation | Behaviour |
|---|---|
| Ready before the user's first tap/keypress (≤ 6 s after start, or the download began in that window) and offline queue empty | apply silently — user sees the new build, plus an "Updated to version X" pill |
| Ready mid-session, safe route, queue empty | banner with 10 s countdown → apply |
| Ready on a form / cert test / sign-in page / with pending offline submissions | banner with **Update now** + **Later**, no countdown; countdown starts when the user leaves the form or the queue drains |
| **Later** | hides the banner for 30 min; still applies at next launch |
| Chunk load failure | blocking overlay; applies the moment the worker is ready, regardless of route |
| Worker never takes control after `SKIP_WAITING` (8 s) | `failed` — banner with **Update now** / **Reset app** |
| Server newer but no worker arrives (90 s) | `failed` (if a worker controls the page) or one guarded network reload (no worker, e.g. first visit) |

### The one reload

`window.location.reload()` is called from exactly one place: `onControllerChange`, i.e. after the new worker has taken control, so the reload always lands on the new shell. Before reloading, the controller writes an `atts-update-applied` marker (`fromBuildTime`). On the next start it consumes the marker:

- `fromBuildTime !== BUILD_TIME` → success → `appliedUpdate` → pill.
- same `BUILD_TIME` → the reload landed on the old build → `failed` with an explanation; **no automatic retry**. The user can tap Update or Reset app.

`reloadGuard` additionally refuses any second automatic reload for the same target build and more than two per 10 minutes. User taps are never blocked.

### Service worker

- `sw.ts` registers a `NavigationRoute(createHandlerBoundToURL('index.html'))` with a denylist for `sw.js`, `version.json`, `manifest.json`, `/assets/`, `/api/`, etc. The shell is always the precached one, so JS/CSS hashes always match.
- `skipWaiting()` is **not** called automatically; the controller posts `SKIP_WAITING` when policy says so.
- `version.json` and `manifest.json` are not precached (`globPatterns` excludes `.json`).

### Caching headers (`vercel.json`)

Order matters: Vercel applies later matching header rules over earlier ones for the same header.

| Path | Cache-Control |
|---|---|
| `/assets/(.*)` | `public, max-age=31536000, immutable` |
| `/sw.js`, `/version.json`, `/index.html` | `no-cache, no-store, must-revalidate` |
| unhashed images / icons | `public, max-age=86400, stale-while-revalidate=604800` |

`public/_headers` is a legacy Cloudflare Pages file and is ignored by Vercel.

## Diagnostics

In any deployed build, open the console:

```js
__ATTS_UPDATE__.version            // running version
__ATTS_UPDATE__.buildTime          // running buildTime (compare with /version.json)
__ATTS_UPDATE__.state()            // { status, reason, targetVersion, countdownSecondsLeft, pendingQueueCount, error, ... }
await __ATTS_UPDATE__.checkForUpdates()
sessionStorage['atts-update-reloads']   // reload guard record
```

Logs are prefixed `[AppUpdate]`.

## Tests

- Unit (`tests/unit/lib/appUpdate/*`): reload guard, version check, safe routes, and the controller state machine with a fake service-worker adapter — including "server newer forever, worker never ready → zero reloads", "reload landed on old build → stop", snooze, queue deferral, chunk error, and no-SW fallback.
- E2E (`tests/e2e/app-update.spec.ts`): newer `version.json` → at most one load, sign-in stays usable, no blocking overlay; matching `version.json` → idle.
- Manual (local deploy simulation): build twice into two folders, serve them behind a tiny static server with Vercel-like headers, flip the folder while the app is open, and confirm one reload and the pill. Steps in the checklist below.

## Pre-flight checklist (run before every release that touches sw.ts, vite.config.ts, vercel.json or src/lib/appUpdate)

- [ ] `npm run lint` — clean
- [ ] `npm run typecheck` — clean
- [ ] `npx vitest run --config tests/vitest.config.ts tests/unit/lib/appUpdate` — green
- [ ] `npm run build` — green; `dist/sw.js` precache does **not** list `version.json` or `manifest.json`; it does list `index.html`
- [ ] `dist/version.json` `buildTime` equals `__BUILD_TIME__` baked into the bundle (same value from `vite.config.ts`)
- [ ] `npx playwright test tests/e2e/app-update.spec.ts --project=chromium` — green
- [ ] Deploy simulation, desktop viewport: open build A → switch server to B → reopen → exactly one reload, pill "Updated…", `__ATTS_UPDATE__.state().status === 'idle'`
- [ ] Deploy simulation, 390 px mobile viewport: tap the page first, switch server → banner with countdown above the nav; **Later** hides it and no reload happens; relaunch applies silently
- [ ] On a form route (`/dashboard/forms/dvir`) with a ready update: banner shows **Update now / Later**, no countdown
- [ ] With an item in the offline queue: banner says it is waiting for pending submissions; no countdown until the queue drains
- [ ] After deploy to Vercel: `curl -sI https://<host>/sw.js | grep -i cache-control` → `no-cache, no-store`; `curl -sI https://<host>/assets/<any>.js` → `immutable`; `curl -s https://<host>/version.json` → new `buildTime`
- [ ] Installed iOS PWA (standalone): background the app, deploy, foreground → banner or silent apply; no loop, sign-in works

## Tuning

`DEFAULT_APP_UPDATE_CONFIG` in `types.ts`: `pollIntervalMs` 5 min, `minCheckGapMs` 20 s, `launchWindowMs` 6 s, `countdownMs` 10 s, `snoozeMs` 30 min, `applyTimeoutMs` 8 s, `downloadTimeoutMs` 90 s. Route safety lives in `safeRoutes.ts`; add a prefix there when a new data-entry page is created.
