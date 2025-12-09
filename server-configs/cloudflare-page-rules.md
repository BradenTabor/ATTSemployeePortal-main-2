# Cloudflare Configuration for ATTS Employee Portal

## Option 1: Cloudflare Pages (Recommended)

Cloudflare Pages automatically handles:
- Brotli compression
- HTTP/2 and HTTP/3
- Edge caching with smart invalidation
- SPA routing

No additional configuration needed for basic setup.

For custom headers, create a `_headers` file in your `public/` folder:

```
# public/_headers

# Immutable assets
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.webp
  Cache-Control: public, max-age=31536000, immutable

/*.avif
  Cache-Control: public, max-age=31536000, immutable

# PWA manifest
/manifest.json
  Cache-Control: public, max-age=86400

# Security headers for all routes
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-XSS-Protection: 1; mode=block
```

## Option 2: Cloudflare with Custom Origin (CDN Mode)

If using Cloudflare as a CDN in front of your own server:

### Page Rules (Legacy)

1. **Cache Static Assets**
   - URL: `*your-domain.com/assets/*`
   - Setting: Cache Level = Cache Everything
   - Edge Cache TTL = 1 year

2. **Cache Images**
   - URL: `*your-domain.com/*.png`
   - Setting: Cache Level = Cache Everything
   - Edge Cache TTL = 1 year
   - (Repeat for .webp, .avif, .jpg)

3. **Bypass Cache for HTML**
   - URL: `*your-domain.com/`
   - Setting: Cache Level = Bypass

### Cache Rules (New - Recommended)

In Cloudflare Dashboard > Caching > Cache Rules:

**Rule 1: Cache Static Assets Forever**
```
Expression: (http.request.uri.path contains "/assets/") or 
            (http.request.uri.path.extension in {"js" "css" "png" "jpg" "webp" "avif" "woff2"})
Action: Eligible for cache
Edge TTL: Override - 1 year
Browser TTL: Override - 1 year
```

**Rule 2: Short Cache for Manifest**
```
Expression: http.request.uri.path eq "/manifest.json"
Action: Eligible for cache
Edge TTL: Override - 1 day
Browser TTL: Override - 1 day
```

**Rule 3: Bypass Cache for HTML**
```
Expression: http.request.uri.path eq "/" or 
            (not http.request.uri.path contains "." and http.request.uri.path ne "/manifest.json")
Action: Bypass cache
```

## Brotli Compression

Cloudflare enables Brotli by default. Verify in:
Dashboard > Speed > Optimization > Content Optimization > Brotli

## Polish (Image Optimization)

For additional image optimization, enable:
Dashboard > Speed > Optimization > Image Optimization > Polish

Options:
- **Lossless**: Safe for logos, preserves quality
- **Lossy**: Best compression for photos

## Additional Recommendations

1. **Enable Auto Minify** for JS, CSS, HTML
   Dashboard > Speed > Optimization > Auto Minify

2. **Enable Early Hints** for faster resource loading
   Dashboard > Speed > Optimization > Early Hints

3. **Enable HTTP/3** for modern browsers
   Dashboard > Network > HTTP/3 (with QUIC)

