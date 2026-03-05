import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// ---------------------------------------------------------------------------
// IndexedDB cleanup between tests — fake-indexeddb may not support
// indexedDB.databases(), so we hardcode the known DB names from our modules.
// ---------------------------------------------------------------------------
const KNOWN_IDB_NAMES = [
  'atts-offline-queue',
  'atts-offline-photos',
  'atts-sync-conflicts',
  'atts-query-cache',
  '__atts_idb_probe__',
];

afterEach(() => {
  for (const name of KNOWN_IDB_NAMES) {
    indexedDB.deleteDatabase(name);
  }
});

// ---------------------------------------------------------------------------
// navigator.storage mock for offlinePhotoStore / useStorageQuota
// ---------------------------------------------------------------------------
if (typeof navigator !== 'undefined' && !navigator.storage) {
  Object.defineProperty(navigator, 'storage', {
    value: {
      estimate: async () => ({ usage: 0, quota: 1024 * 1024 * 500 }), // 500 MB
      persist: async () => true,
      persisted: async () => true,
    },
    writable: true,
    configurable: true,
  });
}

// IntersectionObserver mock for framer-motion useInView (BlurFade, etc.) in jsdom
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: readonly number[] = [];
  observe = () => {};
  unobserve = () => {};
  disconnect = () => {};
  takeRecords = (): IntersectionObserverEntry[] => [];
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

// HTMLMediaElement mocks — jsdom doesn't implement play/pause, causing uncaught
// exceptions when DashboardLayout's visibility handler calls video.play().
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
}

// Minimal canvas 2d mock for DVIR/JSA forms (signature, image preview) in jsdom
if (typeof HTMLCanvasElement !== 'undefined') {
  /* eslint-disable @typescript-eslint/no-unused-vars -- getContext signature, params unused in mock */
  HTMLCanvasElement.prototype.getContext = function (
    _contextId: string,
    _options?: unknown
  ): unknown {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
      putImageData: () => {},
      createImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
      canvas: { width: 0, height: 0, toDataURL: () => 'data:image/png;base64,' },
    };
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
