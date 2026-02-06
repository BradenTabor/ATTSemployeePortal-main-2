#!/usr/bin/env node
/**
 * Generates a 2x PNG of the hero logo for Retina.
 * Source: 612×408 → 2x: 1224×816 (so 2x display at 512px height uses 816px source).
 * Upscaling + aggressive sharpening can cause halos; sharpening is optional (--sharpen) and uses gentle defaults when enabled.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const assetsDir = join(root, 'src/assets');
const input = join(assetsDir, 'ATTS_Logo-removebg-preview.png');
const output2x = join(assetsDir, 'ATTS_Logo-removebg-preview@2x.png');

const COMPRESSION_LEVEL = parseInt(process.env.COMPRESSION_LEVEL || '6', 10);
const MAX_SIZE_KB = 200;
const shouldSharpen = process.argv.includes('--sharpen');

async function enhanceLogo() {
  try {
    await fs.access(input);
  } catch (err) {
    console.error('Error: Source file not found:', input);
    console.error('Ensure you are running from project root.');
    process.exit(1);
  }

  console.log('Output path:', output2x);
  console.log('Ensure Vite can import @2x suffixed files. If import fails, consider naming: ATTS_Logo-2x.png');

  const meta = await sharp(input).metadata();
  const { width: w, height: h } = meta;
  console.log('Current dimensions:', w, 'x', h);

  const w2 = w * 2;
  const h2 = h * 2;

  let pipeline = sharp(input).resize(w2, h2, { fit: 'fill' });
  if (shouldSharpen) {
    // Gentler sharpening for upscaled images (sigma 0.5 can cause halos)
    pipeline = pipeline.sharpen({ sigma: 1.0, m1: 0.5, m2: 0.5 });
  }
  pipeline = pipeline.png({ compressionLevel: COMPRESSION_LEVEL, effort: 10 });

  await pipeline.toFile(output2x);

  const stat = await fs.stat(output2x);
  const sizeKB = (stat.size / 1024).toFixed(1);
  console.log('Created 2x version:', output2x, `(${sizeKB} KB)`);
  if (stat.size > MAX_SIZE_KB * 1024) {
    console.warn(`Warning: 2x is ${sizeKB} KB (target: <${MAX_SIZE_KB} KB)`);
    console.warn('Retry with: COMPRESSION_LEVEL=9 node scripts/enhance-logo.mjs');
  }
}

enhanceLogo().catch((err) => {
  console.error(err);
  process.exit(1);
});
