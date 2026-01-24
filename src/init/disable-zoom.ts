/**
 * Disable desktop browser zoom via Ctrl/Cmd + scroll wheel.
 * 
 * This prevents accidental zoom when users scroll with modifier keys held,
 * and blocks trackpad pinch-zoom on desktop browsers that fire wheel events.
 * 
 * Note: This does NOT prevent browser zoom via keyboard shortcuts (Ctrl/Cmd + +/-).
 * Those are handled by the browser and cannot be intercepted.
 */

function handleWheel(event: WheelEvent): void {
  // Block zoom triggered by Ctrl+scroll (Windows/Linux) or Cmd+scroll (Mac)
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
  }
}

// Attach listener with passive: false to allow preventDefault
document.addEventListener('wheel', handleWheel, { passive: false });

// Also prevent gesture events on Safari (pinch zoom)
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());
