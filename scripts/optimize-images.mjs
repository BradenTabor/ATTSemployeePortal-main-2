#!/usr/bin/env node
/**
 * Asset Optimization Script for ATTS Employee Portal
 *
 * Auto-discovers all PNGs in public/assets/ and converts to WebP in-place.
 * Skips files that already have a .webp sibling.
 *
 * Usage:
 *   node scripts/optimize-images.mjs
 *
 * Prerequisites:
 *   npm install sharp --save-dev
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const WEBP_CONFIG = { quality: 85, effort: 6 };

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

async function findPngs(dir) {
  const entries = await fs.readdir(dir);
  return entries.filter(f => f.endsWith('.png')).map(f => path.join(dir, f));
}

async function main() {
  const assetsDir = path.join(ROOT, 'public', 'assets');

  console.log('\n  ATTS Asset Optimization — PNG → WebP\n');
  console.log('━'.repeat(55));

  const pngs = await findPngs(assetsDir);
  console.log(`\n  Found ${pngs.length} PNG files in public/assets/\n`);

  let converted = 0;
  let skipped = 0;
  let totalOriginal = 0;
  let totalWebp = 0;

  for (const pngPath of pngs.sort()) {
    const name = path.basename(pngPath, '.png');
    const webpPath = path.join(assetsDir, `${name}.webp`);

    const originalSize = (await fs.stat(pngPath)).size;
    totalOriginal += originalSize;

    // Skip if WebP already exists
    try {
      const webpStat = await fs.stat(webpPath);
      totalWebp += webpStat.size;
      skipped++;
      console.log(`  SKIP  ${name}.png (webp exists, ${formatBytes(webpStat.size)})`);
      continue;
    } catch {
      // WebP doesn't exist, proceed
    }

    try {
      await sharp(pngPath).webp(WEBP_CONFIG).toFile(webpPath);
      const webpSize = (await fs.stat(webpPath)).size;
      totalWebp += webpSize;
      const savings = originalSize - webpSize;
      const pct = ((savings / originalSize) * 100).toFixed(0);
      console.log(`  OK    ${name}.png → .webp  ${formatBytes(originalSize)} → ${formatBytes(webpSize)}  (−${pct}%)`);
      converted++;
    } catch (err) {
      console.error(`  FAIL  ${name}.png: ${err.message}`);
    }
  }

  const totalSavings = totalOriginal - totalWebp;
  const pct = totalOriginal > 0 ? ((totalSavings / totalOriginal) * 100).toFixed(1) : 0;

  console.log('\n' + '━'.repeat(55));
  console.log(`\n  Converted: ${converted}  |  Skipped: ${skipped}  |  Total PNGs: ${pngs.length}`);
  console.log(`  Original:  ${formatBytes(totalOriginal)}`);
  console.log(`  WebP:      ${formatBytes(totalWebp)}`);
  console.log(`  Savings:   ${formatBytes(totalSavings)} (${pct}%)\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
