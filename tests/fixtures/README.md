# Test Fixtures

This directory contains test fixture files used by automated tests.

## Image Fixtures

Place test images in this directory for photo upload tests. Required images:

### DVIR Photos
- `oil-dipstick.jpg` - Valid oil dipstick photo (required for DVIR)
- `tire.jpg` - Valid tire photo
- `coolant.jpg` - Valid coolant photo
- `damage.jpg` - Example damage photo
- `detail-clean.jpg` - Detail clean truck photo

### Equipment Photos
- `hydraulic.jpg` - Valid hydraulic fluid level photo (required)
- `overview.jpg` - Equipment overview photo
- `attachments.jpg` - Equipment attachments photo

### Test Image Variants
- `large-image.jpg` - 10MB+ image for size limit testing
- `heic-image.HEIC` - iOS HEIC format for conversion testing
- `rotated-image.jpg` - Image with EXIF rotation data
- `invalid-file.pdf` - Invalid file type for rejection testing
- `special-chars (1).jpg` - Filename with special characters

## Generating Test Images

You can generate placeholder test images using ImageMagick:

```bash
# Generate a 100KB JPEG
convert -size 800x600 xc:gray test-image.jpg

# Generate a large 10MB image
convert -size 4000x3000 xc:gray large-image.jpg

# Generate images with specific content
convert -size 800x600 -gravity center -pointsize 48 \
  -draw "text 0,0 'Oil Dipstick'" xc:white oil-dipstick.jpg
```

## Usage in Tests

```typescript
import path from 'path';

const fixturesDir = path.join(__dirname, '../fixtures');
const oilDipstickPath = path.join(fixturesDir, 'oil-dipstick.jpg');

// In Playwright tests
await page.setInputFiles('[data-testid="oil-dipstick-upload"]', oilDipstickPath);
```
