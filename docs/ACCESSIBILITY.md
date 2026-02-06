# Accessibility

## Viewport and zoom

The app uses a **locked viewport** (`maximum-scale=1.0`, `user-scalable=no`) to prevent unwanted auto-zoom on mobile (e.g. iOS Safari zooming when small-text inputs receive focus). This is intentional for field-use UX consistency: workers use the app in conditions where accidental zoom and inability to zoom back out would be problematic.

### Rationale

- **Why lock zoom:** We deliberately removed pinch-to-zoom. If the browser auto-zooms when an input is focused (e.g. after closing a modal), users cannot zoom back out, leaving the app in a bad state.
- **How we stay accessible:** We compensate with:
  - **Minimum 16px font size** for all focusable inputs and textareas on mobile (via `text-base` or `text-base sm:text-sm`), so the browser has no reason to auto-zoom.
  - **Large touch targets** (minimum 44px height where applicable) for interactive elements.
  - Shared constants (`MOBILE_SAFE_INPUT`, `MOBILE_SAFE_TEXTAREA` in `src/lib/styles.ts`) to keep forms consistent and prevent regression.

### References

- [index.html](/index.html) – viewport meta and comment.
- [src/lib/styles.ts](/src/lib/styles.ts) – mobile-safe input/textarea classes.
- Plan: Fix Mobile Auto-Zoom (viewport + input font-size).
