/**
 * Disable desktop browser zoom via Ctrl/Cmd + scroll wheel and keyboard shortcuts.
 * 
 * This prevents accidental zoom when users scroll with modifier keys held,
 * blocks trackpad pinch-zoom on desktop browsers that fire wheel events,
 * and blocks keyboard zoom shortcuts (Ctrl/Cmd + +/-/0).
 */

function handleWheel(event: WheelEvent): void {
  // Block zoom triggered by Ctrl+scroll (Windows/Linux) or Cmd+scroll (Mac)
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
  }
}

/**
 * Block keyboard zoom shortcuts:
 * - Zoom in: Ctrl/Cmd + + or =
 * - Zoom out: Ctrl/Cmd + -
 * - Reset zoom: Ctrl/Cmd + 0
 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey) {
    // Check for zoom keys (both main keyboard and numpad)
    const isZoomIn = event.key === '+' || event.key === '=' || event.code === 'NumpadAdd';
    const isZoomOut = event.key === '-' || event.code === 'NumpadSubtract';
    const isZoomReset = event.key === '0' || event.code === 'Numpad0';

    if (isZoomIn || isZoomOut || isZoomReset) {
      event.preventDefault();
    }
  }
}

// Attach listener with passive: false to allow preventDefault
document.addEventListener('wheel', handleWheel, { passive: false });

// Attach keydown listener with capture to run before other handlers
document.addEventListener('keydown', handleKeydown, { capture: true });

// Also prevent gesture events on Safari (pinch zoom)
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());
