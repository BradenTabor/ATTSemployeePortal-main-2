/**
 * Client-side image compression for form photo uploads (Phase 2).
 * Uses browser-image-compression to reduce file size before uploading to storage.
 */

import imageCompression from 'browser-image-compression';
import { logger } from './logger';

export interface CompressionOptions {
  /** Max width in pixels (default 1920) */
  maxSizeMB?: number;
  /** Max dimension (width or height) in pixels (default 1920) */
  maxWidthOrHeight?: number;
  /** Initial quality 0–1 (default 0.8) */
  initialQuality?: number;
  /** Use web worker to avoid blocking main thread (default true) */
  useWebWorker?: boolean;
}

const DEFAULTS: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  initialQuality: 0.85,
  useWebWorker: true,
};

/**
 * Compress an image file for upload. Preserves filename and type when possible.
 * Non-image files are returned unchanged.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB,
      maxWidthOrHeight: opts.maxWidthOrHeight,
      initialQuality: opts.initialQuality,
      useWebWorker: opts.useWebWorker,
    });

    const outName = file.name.replace(/\.[^.]+$/, '.jpg') || file.name;
    const out = compressed.name !== outName
      ? new File([compressed], outName, { type: compressed.type || 'image/jpeg' })
      : compressed;

    if (import.meta.env.DEV && file.size > 0) {
      const ratio = ((1 - out.size / file.size) * 100).toFixed(0);
      logger.debug('[imageCompression]', { original: file.size, compressed: out.size, ratio: `${ratio}%` });
    }

    return out;
  } catch (err) {
    logger.warn('[imageCompression] Compression failed, using original file', err);
    return file;
  }
}
