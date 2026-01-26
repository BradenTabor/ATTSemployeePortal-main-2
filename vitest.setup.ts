import '@testing-library/jest-dom/vitest';

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
