# Performance Baseline — ATTS Employee Portal

**Date:** 2026-03-20
**Vite:** 7.3.0 | **Build time:** 11.75s

---

## Bundle Summary

| Metric | Value |
|--------|-------|
| Total JS (raw) | 7.7 MB |
| Total CSS (raw) | 412 KB (gzip: ~49 KB) |
| JS chunks | 255 |
| CSS chunks | 3 |
| SW precache entries | 313 (23.4 MB) |
| Main index chunk | 253.45 KB (gzip: 72.37 KB) |

## Top 10 JS Chunks (by raw size)

| Chunk | Raw | Gzip |
|-------|-----|------|
| vendor-react-pdf | 1,572.91 KB | 526.34 KB |
| vendor-xlsx | 428.03 KB | 142.59 KB |
| vendor-jspdf | 417.79 KB | 136.17 KB |
| vendor-recharts | 358.32 KB | 106.74 KB |
| index (main entry) | 253.45 KB | 72.37 KB |
| html2canvas.esm | 200.54 KB | 47.30 KB |
| vendor-react | 170.16 KB | 56.10 KB |
| vendor-supabase | 166.40 KB | 43.12 KB |
| EnhancedEmptyStates | 166.22 KB | 36.23 KB |
| DailyJSAForm | 158.23 KB | 40.64 KB |

## Modulepreload Links (in dist/index.html)

Vite already injects modulepreload for 7 vendor chunks:
- vendor-query (49.86 KB)
- vendor-query-persist
- vendor-react (170.16 KB)
- vendor-supabase (166.40 KB)
- vendor-jspdf (417.79 KB)
- vendor-motion (129.22 KB)
- vendor-utils (52.38 KB)

**Note:** vendor-jspdf is modulepreloaded but only used on export actions (dynamically imported). This preload is wasteful — it forces ~418 KB to load on every page even though most users never export PDFs. Candidate for removal from modulepreload.

## Static Asset Sizes

| Directory | Size |
|-----------|------|
| public/assets/ (images) | 16 MB |
| public/videos/ | 137 MB |
| Total public static | ~153 MB |

### Largest Images (PNG)

| File | Size | WebP exists? |
|------|------|:---:|
| daily-safety-briefing.png | 4.3 MB | Yes (100 KB) |
| emergency-action-plan.png | 2.5 MB | Yes (260 KB) |
| grade-tests.png | 1.3 MB | Yes (100 KB) |
| job-site.png | 476 KB | No |
| general-foreman-specialist.png | 304 KB | No |
| tree-cutter.png | 260 KB | No |
| jobs-specialist.png | 252 KB | No |
| all-tools.png | 244 KB | No |

47 total PNGs in public/assets/, only 3 have WebP alternatives.

### Videos

| File | Size |
|------|------|
| 4k.mp4 | 77 MB |
| evergreen-bg.mp4 | 46 MB |
| safety-briefing-bg.mp4 | 14 MB |

All are background/decorative videos with audio tracks (unnecessary for autoplay backgrounds).

## Build Configuration Notes

- Code splitting: 53 lazy routes, heavy libs (xlsx, jspdf, react-pdf, recharts) in manual vendor chunks
- Dynamic imports: xlsx, jspdf, react-pdf correctly dynamic-imported at usage site
- Tree shaking: esbuild with `drop: ['console', 'debugger']`
- Source maps: disabled in production
- Target: ES2020

## Known Issues (pre-optimization)

1. **vendor-react-pdf at 1.57 MB** — largest single chunk; dynamically imported but still huge
2. **vendor-jspdf in modulepreload** — 418 KB loaded on every page despite being used only on export
3. **47 PNGs served unoptimized** — only 3/47 have WebP versions; ~8 MB saveable on top 3 alone
4. **137 MB of video** — uncompressed, no audio stripping, per-page payload 14–77 MB
5. **AuthContext value not memoized** — new object every render, 50+ consumers re-render
6. **Sequential Supabase queries** — 4 hooks with 2-5 sequential awaits that could be parallelized
7. **EnhancedEmptyStates at 166 KB** — unexpectedly large for empty state components; investigate
8. **html2canvas at 200 KB** — loaded somewhere; verify if dynamically imported or eager

---

*This baseline will be compared against post-optimization measurements after each tier is complete.*
