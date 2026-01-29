# Modals and Full-Screen Overlays

This doc explains how to implement modals and full-screen overlays so they **display correctly** and **do not allow the user to scroll the page behind them**. This has been a recurring bug (e.g. DVIR form success overlay, draft recovery, etc.); follow these rules to avoid regressions.

## Root cause of "user can scroll out of overlay"

1. **Overlay rendered inside the dashboard scroll container**  
   Pages using `DashboardLayout` put content inside a scrollable wrapper with `data-scroll-container` and `overflow-y-auto`. If the overlay is rendered *inside* that wrapper (as a sibling of the form/content):
   - `position: fixed` can be tied to that scroll container when an ancestor has `transform`, `filter`, or `perspective` (CSS containing block).
   - The scroll container is still scrollable, so the user can scroll the page and "escape" the overlay.

2. **Only locking `body` is not enough**  
   In this app, the main scroll is on the inner `[data-scroll-container]` div, not on `body`. Setting `document.body.style.overflow = 'hidden'` alone does not prevent that container from scrolling.

## Required pattern for full-screen overlays

Use **both** of the following:

### 1. Portal to `document.body`

Render the overlay with `createPortal(..., document.body)` so the overlay DOM lives outside the layout. Then `position: fixed; inset: 0` is relative to the viewport and is not affected by the dashboard scroll container.

**Example:**

```tsx
import { createPortal } from 'react-dom';
const content = ( ... );
return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
```

### 2. Lock both body and the dashboard scroll container

When the overlay is visible, set `overflow: hidden` on:
- `document.body`
- The element with `[data-scroll-container]` (the dashboard scroll wrapper)

Restore previous values on unmount or when the overlay closes. See `FormSuccessCelebration.tsx` for the exact useEffect.

### 3. Optional: `overflow-hidden` on the overlay wrapper

Add `overflow-hidden` to the outer overlay div so the overlay stays fully covering the viewport.

## Components that already follow this pattern

- **FormSuccessCelebration** – portal + scroll lock (body + `[data-scroll-container]`)
- **FullComplianceCelebration** – portal to body
- **DraftRecoveryModal** – portal + useModalOverlay
- **AdminUsers** (modals) – portal + body + scroll container lock

## Quick checklist for new overlays

- [ ] Rendered with `createPortal(..., document.body)` (portal to body).
- [ ] When open: lock `document.body` and `[data-scroll-container]` overflow; restore on close.
- [ ] Outer overlay wrapper has `overflow-hidden` and high z-index (e.g. `z-[9999]`).
- [ ] `role="dialog"` and `aria-modal="true"` for accessibility.

## Search keywords for future fixes

If the bug ("user can scroll out of overlay") reappears, search for:
- `ModalsAndOverlays.md` (this file)
- `data-scroll-container` (dashboard scroll wrapper)
- `createPortal` + `document.body`
- `FormSuccessCelebration` (reference implementation)
