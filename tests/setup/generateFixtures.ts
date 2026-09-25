/**
 * Generate Test Fixtures Script
 * 
 * Creates test image files for photo upload testing.
 * Generates images of various sizes and formats.
 * 
 * Usage: npx tsx tests/setup/generateFixtures.ts
 */

import * as fs from 'fs';
import sharp from 'sharp';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

// Ensure fixtures directory exists
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

/** Real decodable JPEG data; trailing padding preserves file-size boundary fixtures. */
async function generateMinimalJPEG(sizeKB: number = 10): Promise<Buffer> {
  const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#228b55' } })
    .jpeg({ quality: 85 }).toBuffer();
  return Buffer.concat([jpeg, Buffer.alloc(Math.max(0, sizeKB * 1024 - jpeg.length))]);
}

/**
 * Generate test fixtures
 */
async function generateFixtures(): Promise<void> {
  console.log('='.repeat(60));
  console.log('GENERATING TEST FIXTURES');
  console.log('='.repeat(60));
  console.log(`Output directory: ${FIXTURES_DIR}`);
  console.log('');
  
  const fixtures: { name: string; size: number; description: string }[] = [];
  
  // Standard test images (small, for fast tests)
  const standardImages = [
    { name: 'oil-dipstick.jpg', label: 'Oil Dipstick' },
    { name: 'tire.jpg', label: 'Tire Photo' },
    { name: 'coolant.jpg', label: 'Coolant Level' },
    { name: 'damage.jpg', label: 'Damage Photo' },
    { name: 'detail-clean.jpg', label: 'Detail Clean' },
    { name: 'hydraulic.jpg', label: 'Hydraulic Level' },
    { name: 'overview.jpg', label: 'Equipment Overview' },
    { name: 'attachments.jpg', label: 'Attachments' },
  ];
  
  for (const img of standardImages) {
    const buffer = await generateMinimalJPEG(50); // 50KB each
    const filepath = path.join(FIXTURES_DIR, img.name);
    fs.writeFileSync(filepath, buffer);
    fixtures.push({ name: img.name, size: buffer.length, description: img.label });
    console.log(`  ✓ Created ${img.name} (${Math.round(buffer.length / 1024)}KB)`);
  }
  
  // Large image for size limit testing
  const largeImage = await generateMinimalJPEG(5000); // 5MB
  const largePath = path.join(FIXTURES_DIR, 'large-image.jpg');
  fs.writeFileSync(largePath, largeImage);
  fixtures.push({ name: 'large-image.jpg', size: largeImage.length, description: 'Large image for size testing' });
  console.log(`  ✓ Created large-image.jpg (${Math.round(largeImage.length / 1024 / 1024)}MB)`);
  
  // Very large image (for rejection testing)
  const hugeImage = await generateMinimalJPEG(15000); // 15MB
  const hugePath = path.join(FIXTURES_DIR, 'huge-image.jpg');
  fs.writeFileSync(hugePath, hugeImage);
  fixtures.push({ name: 'huge-image.jpg', size: hugeImage.length, description: 'Huge image for rejection testing' });
  console.log(`  ✓ Created huge-image.jpg (${Math.round(hugeImage.length / 1024 / 1024)}MB)`);
  
  // Invalid file type
  const invalidPdf = Buffer.from('%PDF-1.4 Invalid PDF Content for Testing', 'utf8');
  const invalidPath = path.join(FIXTURES_DIR, 'invalid-file.pdf');
  fs.writeFileSync(invalidPath, invalidPdf);
  fixtures.push({ name: 'invalid-file.pdf', size: invalidPdf.length, description: 'Invalid file type' });
  console.log(`  ✓ Created invalid-file.pdf (${invalidPdf.length} bytes)`);
  
  // Special characters in filename
  const specialChars = await generateMinimalJPEG(30);
  const specialPath = path.join(FIXTURES_DIR, 'special-chars (1).jpg');
  fs.writeFileSync(specialPath, specialChars);
  fixtures.push({ name: 'special-chars (1).jpg', size: specialChars.length, description: 'Special chars in name' });
  console.log(`  ✓ Created "special-chars (1).jpg" (${Math.round(specialChars.length / 1024)}KB)`);
  
  // Create manifest file
  const manifest = {
    generated: new Date().toISOString(),
    fixtures,
  };
  fs.writeFileSync(
    path.join(FIXTURES_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('');
  console.log('='.repeat(60));
  console.log(`Generated ${fixtures.length} test fixtures`);
  console.log('='.repeat(60));
  
  // Note about real images
  console.log('');
  console.log('Fixtures are decodable JPEG images with size-boundary padding.');
  console.log('For visual testing, replace with actual photos.');
  console.log('');
}

// Run
generateFixtures().catch(console.error);
