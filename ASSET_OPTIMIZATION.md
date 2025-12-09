# ATTS Portal Asset Optimization

This document summarizes the asset optimizations implemented for the ATTS Employee Portal.

## Summary of Changes

### 1. Image Conversion Script

**File:** `scripts/optimize-images.mjs`

Converts PNG/JPG images to WebP format with safe quality defaults.

**To run:**
```bash
# Install sharp (one-time)
npm install sharp --save-dev

# Run the conversion
node scripts/optimize-images.mjs
```

**Output:**
- Optimized images in `src/assets/optimized/` and `public/optimized/`
- Manifest at `scripts/asset-manifest.json`

**Estimated savings:**
| Original | Current | WebP Est. | Savings |
|----------|---------|-----------|---------|
| Logo PNG | 34KB | ~10KB | ~24KB |
| icon-512 | 30KB | ~12KB | ~18KB |
| icon-192 | 11KB | ~4KB | ~7KB |
| **Total** | **75KB** | **~26KB** | **~49KB (65%)** |

### 2. Markup Improvements

**fetchPriority="high" added to hero images:**
- `src/pages/Home.tsx` - Login page logo (LCP element)
- `src/layouts/DashboardLayout.tsx` - Dashboard header logo

**loading="lazy" added to below-fold images:**
- `src/components/Footer.tsx` - Footer logo
- `src/components/AnnouncementCard.tsx` - Card watermark
- `src/components/DashboardAnnouncementCard.tsx` - Card watermark

### 3. Server Caching Configs

Created in `server-configs/`:

| File | Platform | Notes |
|------|----------|-------|
| `netlify.toml` | Netlify | Copy to project root |
| `vercel.json` | Vercel | Copy to project root |
| `nginx.conf` | Nginx | Include in server block |
| `cloudflare-page-rules.md` | Cloudflare | Setup guide |

**Also created:** `public/_headers` for Cloudflare Pages (auto-deployed)

### 4. Unused Assets Removed

- Deleted `src/assets/ATTS Logo.jpg` (10KB) - was not referenced anywhere

## How to Apply Image Conversions

After running the conversion script, update imports to use WebP:

```tsx
// Before
import logo from "../assets/ATTS_Logo-removebg-preview.png";

// After (with fallback for older browsers)
import logoWebP from "../assets/optimized/ATTS_Logo-removebg-preview.webp";
import logoPNG from "../assets/ATTS_Logo-removebg-preview.png";

// Usage with picture element for fallback
<picture>
  <source srcSet={logoWebP} type="image/webp" />
  <img src={logoPNG} alt="ATTS Logo" />
</picture>
```

For PWA icons, update `public/manifest.json`:
```json
{
  "icons": [
    {
      "src": "/optimized/icon-192.webp",
      "sizes": "192x192",
      "type": "image/webp"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## Server Configuration

### Netlify
Copy `server-configs/netlify.toml` to your project root.

### Vercel
Copy `server-configs/vercel.json` to your project root.

### Nginx
Include the server block from `server-configs/nginx.conf` or merge headers into your existing config.

### Cloudflare Pages
The `public/_headers` file is automatically processed during deployment.

## Rollback Instructions

**Revert markup changes:**
```bash
git checkout src/pages/Home.tsx
git checkout src/layouts/DashboardLayout.tsx
git checkout src/components/Footer.tsx
git checkout src/components/AnnouncementCard.tsx
git checkout src/components/DashboardAnnouncementCard.tsx
```

**Remove optimized assets:**
```bash
rm -rf src/assets/optimized public/optimized scripts/asset-manifest.json
```

**Remove server configs:**
```bash
rm -rf server-configs public/_headers
```

**Restore deleted file:**
```bash
git checkout src/assets/ATTS\ Logo.jpg
```

## Estimated Total Savings

| Category | Savings |
|----------|---------|
| Image conversion (WebP) | ~49KB |
| Unused file deletion | 10KB |
| Brotli compression (on server) | ~200-250KB transfer |
| **Total transfer reduction** | **~300KB (20-25%)** |

## Commands Reference

```bash
# Run image optimization
node scripts/optimize-images.mjs

# Build with optimizations applied
npm run build

# Test locally
npm run preview
```

