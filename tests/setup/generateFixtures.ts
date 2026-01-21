/**
 * Generate Test Fixtures Script
 * 
 * Creates test image files for photo upload testing.
 * Generates images of various sizes and formats.
 * 
 * Usage: npx tsx tests/setup/generateFixtures.ts
 */

import * as fs from 'fs';
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

/**
 * Generate a simple PPM image (can be converted to other formats)
 * PPM is a simple uncompressed format that's easy to generate
 * NOTE: Currently unused but kept for potential future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generatePPM(width: number, height: number, label: string): Buffer {
  const header = `P6\n${width} ${height}\n255\n`;
  const headerBuffer = Buffer.from(header, 'ascii');
  
  // Create pixel data (RGB)
  const pixels = Buffer.alloc(width * height * 3);
  
  // Fill with a gradient pattern
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      // Green gradient for ATTS brand color
      pixels[idx] = Math.floor((x / width) * 100);     // R
      pixels[idx + 1] = Math.floor(100 + (y / height) * 155); // G (green dominant)
      pixels[idx + 2] = Math.floor((x / width) * 80);  // B
    }
  }
  
  return Buffer.concat([headerBuffer, pixels]);
}

/**
 * Generate a minimal valid JPEG-like structure
 * This is a placeholder - real tests should use actual images
 */
function generateMinimalJPEG(sizeKB: number = 10): Buffer {
  // JPEG magic bytes and minimal structure
  const header = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00
  ]);
  
  // Fill to desired size
  const padding = Buffer.alloc(sizeKB * 1024 - header.length - 2, 0x00);
  
  // JPEG end marker
  const footer = Buffer.from([0xFF, 0xD9]);
  
  return Buffer.concat([header, padding, footer]);
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
    const buffer = generateMinimalJPEG(50); // 50KB each
    const filepath = path.join(FIXTURES_DIR, img.name);
    fs.writeFileSync(filepath, buffer);
    fixtures.push({ name: img.name, size: buffer.length, description: img.label });
    console.log(`  ✓ Created ${img.name} (${Math.round(buffer.length / 1024)}KB)`);
  }
  
  // Large image for size limit testing
  const largeImage = generateMinimalJPEG(5000); // 5MB
  const largePath = path.join(FIXTURES_DIR, 'large-image.jpg');
  fs.writeFileSync(largePath, largeImage);
  fixtures.push({ name: 'large-image.jpg', size: largeImage.length, description: 'Large image for size testing' });
  console.log(`  ✓ Created large-image.jpg (${Math.round(largeImage.length / 1024 / 1024)}MB)`);
  
  // Very large image (for rejection testing)
  const hugeImage = generateMinimalJPEG(15000); // 15MB
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
  const specialChars = generateMinimalJPEG(30);
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
  console.log('NOTE: These are placeholder files with valid headers.');
  console.log('For visual testing, replace with actual photos.');
  console.log('');
}

// Run
generateFixtures().catch(console.error);
