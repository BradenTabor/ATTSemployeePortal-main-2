/**
 * Signature validation for canvas/image signatures.
 * Prevents accidental or empty submissions using bounding box and minimum ink.
 */

export interface SignatureValidationResult {
  valid: boolean;
  error?: string;
}

const MIN_BBOX_WIDTH = 40;
const MIN_BBOX_HEIGHT = 15;
const MIN_OPAQUE_PIXELS = 80;

/**
 * Validate a signature from a data URL (e.g. from canvas.toDataURL('image/png')).
 * Requires minimum bounding box size and minimum "ink" (non-transparent pixels).
 */
export function validateSignatureFromDataUrl(
  dataUrl: string
): Promise<SignatureValidationResult> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return Promise.resolve({ valid: false, error: 'Signature is required' });
  }

  return new Promise<SignatureValidationResult>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ valid: false, error: 'Could not validate signature' });
        return;
      }
      ctx.drawImage(img, 0, 0);
      const result = validateSignatureFromCanvasContext(ctx, canvas.width, canvas.height);
      resolve(result);
    };
    img.onerror = () => resolve({ valid: false, error: 'Invalid signature image' });
    img.src = dataUrl;
  });
}

/**
 * Validate from canvas 2d context (synchronous). Use when you have the canvas ref.
 */
export function validateSignatureFromCanvas(
  canvas: HTMLCanvasElement
): SignatureValidationResult {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { valid: false, error: 'Could not validate signature' };
  return validateSignatureFromCanvasContext(ctx, canvas.width, canvas.height);
}

function validateSignatureFromCanvasContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): SignatureValidationResult {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let opaqueCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha > 20) {
        opaqueCount++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const bboxWidth = maxX - minX + 1;
  const bboxHeight = maxY - minY + 1;

  if (opaqueCount < MIN_OPAQUE_PIXELS) {
    return { valid: false, error: 'Please draw a clearer signature' };
  }
  if (bboxWidth < MIN_BBOX_WIDTH || bboxHeight < MIN_BBOX_HEIGHT) {
    return { valid: false, error: 'Signature is too small; please sign in the full area' };
  }

  return { valid: true };
}
