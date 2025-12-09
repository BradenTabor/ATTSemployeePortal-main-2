#!/usr/bin/env node
/**
 * Asset Optimization Script for ATTS Employee Portal
 * 
 * Converts PNG/JPG images to WebP format with safe quality defaults.
 * Outputs to parallel folders without overwriting originals.
 * Generates a manifest mapping original -> optimized files.
 * 
 * Usage:
 *   npm install sharp --save-dev
 *   node scripts/optimize-images.mjs
 * 
 * Rollback:
 *   rm -rf src/assets/optimized public/optimized
 *   rm scripts/asset-manifest.json
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Configuration
const CONFIG = {
  webp: {
    quality: 85,
    effort: 6, // 0-6, higher = smaller file but slower
  },
  avif: {
    quality: 80,
    effort: 6,
  },
  // Set to true to also generate AVIF (better compression, less browser support)
  generateAvif: false,
};

// Files to convert (relative to project root)
const ASSETS_TO_CONVERT = [
  {
    input: 'src/assets/ATTS_Logo-removebg-preview.png',
    outputDir: 'src/assets/optimized',
    name: 'ATTS_Logo-removebg-preview',
  },
  {
    input: 'public/icon-192.png',
    outputDir: 'public/optimized',
    name: 'icon-192',
  },
  {
    input: 'public/icon-512.png',
    outputDir: 'public/optimized',
    name: 'icon-512',
  },
];

// Manifest to track conversions
const manifest = {
  generatedAt: new Date().toISOString(),
  conversions: [],
};

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

async function convertImage(asset) {
  const inputPath = path.join(ROOT, asset.input);
  const outputDir = path.join(ROOT, asset.outputDir);
  
  // Check if input exists
  try {
    await fs.access(inputPath);
  } catch {
    console.error(`  ⚠️  Input file not found: ${asset.input}`);
    return null;
  }

  await ensureDir(outputDir);

  const originalSize = await getFileSize(inputPath);
  const results = {
    original: {
      path: asset.input,
      size: originalSize,
    },
    outputs: [],
  };

  // Convert to WebP
  const webpPath = path.join(outputDir, `${asset.name}.webp`);
  try {
    await sharp(inputPath)
      .webp(CONFIG.webp)
      .toFile(webpPath);
    
    const webpSize = await getFileSize(webpPath);
    const savings = originalSize - webpSize;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
    
    results.outputs.push({
      format: 'webp',
      path: path.relative(ROOT, webpPath),
      size: webpSize,
      savings,
      savingsPercent: `${savingsPercent}%`,
    });

    console.log(`  ✅ WebP: ${formatBytes(webpSize)} (saved ${formatBytes(savings)}, ${savingsPercent}%)`);
  } catch (err) {
    console.error(`  ❌ WebP conversion failed: ${err.message}`);
  }

  // Optionally convert to AVIF
  if (CONFIG.generateAvif) {
    const avifPath = path.join(outputDir, `${asset.name}.avif`);
    try {
      await sharp(inputPath)
        .avif(CONFIG.avif)
        .toFile(avifPath);
      
      const avifSize = await getFileSize(avifPath);
      const savings = originalSize - avifSize;
      const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
      
      results.outputs.push({
        format: 'avif',
        path: path.relative(ROOT, avifPath),
        size: avifSize,
        savings,
        savingsPercent: `${savingsPercent}%`,
      });

      console.log(`  ✅ AVIF: ${formatBytes(avifSize)} (saved ${formatBytes(savings)}, ${savingsPercent}%)`);
    } catch (err) {
      console.error(`  ❌ AVIF conversion failed: ${err.message}`);
    }
  }

  return results;
}

async function main() {
  console.log('\n🖼️  ATTS Asset Optimization\n');
  console.log('━'.repeat(50));

  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const asset of ASSETS_TO_CONVERT) {
    console.log(`\n📄 ${asset.input}`);
    
    const result = await convertImage(asset);
    if (result) {
      manifest.conversions.push(result);
      totalOriginal += result.original.size;
      
      // Use WebP size for total (primary format)
      const webpOutput = result.outputs.find(o => o.format === 'webp');
      if (webpOutput) {
        totalOptimized += webpOutput.size;
      }
    }
  }

  // Write manifest
  const manifestPath = path.join(ROOT, 'scripts', 'asset-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  // Summary
  const totalSavings = totalOriginal - totalOptimized;
  const savingsPercent = totalOriginal > 0 
    ? ((totalSavings / totalOriginal) * 100).toFixed(1) 
    : 0;

  console.log('\n' + '━'.repeat(50));
  console.log('\n📊 Summary:\n');
  console.log(`   Original total:  ${formatBytes(totalOriginal)}`);
  console.log(`   Optimized total: ${formatBytes(totalOptimized)}`);
  console.log(`   Total savings:   ${formatBytes(totalSavings)} (${savingsPercent}%)`);
  console.log(`\n   Manifest written to: scripts/asset-manifest.json`);
  
  console.log('\n📋 Next Steps:\n');
  console.log('   1. Update imports in components to use WebP versions');
  console.log('   2. For PWA icons, update public/manifest.json');
  console.log('   3. Consider using <picture> tags for fallback support\n');
  
  console.log('🔄 Rollback command:');
  console.log('   rm -rf src/assets/optimized public/optimized scripts/asset-manifest.json\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

