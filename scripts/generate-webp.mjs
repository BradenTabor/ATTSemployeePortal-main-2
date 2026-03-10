#!/usr/bin/env node
/**
 * Generate WebP versions of the largest PNGs in public/assets for bandwidth optimization.
 * Run: node scripts/generate-webp.mjs
 * Then reference the .webp paths in the app (e.g. emergency-action-plan.webp).
 */
import { readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "public", "assets");

const LARGE_PNGS = [
  "emergency-action-plan.png",
  "daily-safety-briefing.png",
  "grade-tests.png",
];

async function main() {
  for (const name of LARGE_PNGS) {
    const inputPath = join(ASSETS, name);
    const outputPath = join(ASSETS, name.replace(/\.png$/i, ".webp"));
    try {
      const buf = await readFile(inputPath);
      const out = await sharp(buf)
        .webp({ quality: 85 })
        .toBuffer();
      await writeFile(outputPath, out);
      console.log(`${name} -> ${name.replace(/\.png$/i, ".webp")} (${(out.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`Failed ${name}:`, err.message);
    }
  }
}

main();
