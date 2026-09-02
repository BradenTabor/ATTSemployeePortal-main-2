import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';

// Read version from package.json at build time
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const appVersion = packageJson.version;
const buildTime = new Date().toISOString();

/** Inject Supabase preconnect/dns-prefetch using project URL (VITE_SUPABASE_URL) so the browser connects to the actual API origin. */
function supabasePreconnectPlugin(supabaseUrl: string): Plugin {
  const origin = supabaseUrl.trim().replace(/\/$/, '');
  return {
    name: 'html-supabase-preconnect',
    transformIndexHtml(html) {
      const placeholder = /(\s*<!-- Supabase preconnect: injected at build from VITE_SUPABASE_URL[^]*?-->)/s;
      if (!origin || !placeholder.test(html)) return html;
      const links =
        `\n    <!-- Supabase preconnect (project origin from VITE_SUPABASE_URL) -->
    <link rel="preconnect" href="${origin}" crossorigin />
    <link rel="dns-prefetch" href="${origin}" />`;
      return html.replace(placeholder, links);
    },
  };
}

/**
 * Vite emits `<link rel="modulepreload">` for every vendor chunk *before* the
 * stylesheet. The CSS is the only render-blocking resource, so on a slow link
 * it should be first out of the gate rather than sharing bandwidth with ~280 KB
 * of scripts it does not need to wait for. Hoist it above the preloads.
 */
function stylesheetFirstPlugin(): Plugin {
  return {
    name: 'html-stylesheet-first',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const css = html.match(/\s*<link rel="stylesheet"[^>]*>/);
        const firstPreload = html.indexOf('<link rel="modulepreload"');
        if (!css || firstPreload === -1 || css.index === undefined || css.index < firstPreload) return html;
        const without = html.replace(css[0], '');
        const insertAt = without.indexOf('<link rel="modulepreload"');
        return `${without.slice(0, insertAt)}${css[0].trim()}\n    ${without.slice(insertAt)}`;
      },
    },
  };
}

/** Generate version.json for deploy version checking (instant forced update). */
function generateVersionFile(): Plugin {
  return {
    name: 'generate-version-file',
    apply: 'build',
    closeBundle() {
      const versionData = {
        version: appVersion,
        buildTime,
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
        environment: process.env.VERCEL_ENV ?? 'production',
      };
      const outputPath = path.resolve(__dirname, 'dist/version.json');
      writeFileSync(outputPath, JSON.stringify(versionData, null, 2));
      console.log('[Version File] Generated:', outputPath);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL ?? '';

  return {
  // Inject app version as a global constant (same buildTime as version.json)
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    supabasePreconnectPlugin(supabaseUrl),
    stylesheetFirstPlugin(),
    generateVersionFile(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // We'll handle registration manually
      manifest: false, // Use existing /public/manifest.json
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webp}'],
        // Install-time precache is what a field worker downloads on first launch
        // (often on LTE). Keep it to the app shell + every route + the fonts.
        // Export/print-only vendor chunks (~3 MB raw) are excluded here and
        // instead cached on first use by the `/assets/` runtime route in sw.ts.
        globIgnores: [
          '**/assets/vendor-react-pdf-*.js',
          '**/assets/vendor-jspdf-*.js',
          '**/assets/vendor-xlsx-*.js',
          '**/assets/html2canvas*.js',
          '**/assets/index.es-*.js', // canvg (svg → canvas, jspdf dependency)
          '**/assets/purify.es-*.js', // dompurify (jspdf dependency)
          // Nav-card artwork (~1.5 MB) — runtime-cached on first render instead.
          // Canopy background textures live in assets/canopy/ and stay precached.
          'assets/*.webp',
        ],
        // See https://vite-pwa-org.netlify.app/guide/faq.html#missing-assets-from-sw-precache-manifest
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Removed jspdf alias to ensure proper code-splitting via dynamic imports
    },
  },
  build: {
    minify: 'esbuild',
    // Developer visibility: warn when a chunk exceeds 500 KiB after minification.
    // Strict enforcement is in scripts/checkBundleSize.mjs (vendor-react, vendor-supabase, main-index).
    // If build logs are noisy, raise this (e.g. 550) but do not relax checkBundleSize.mjs thresholds.
    chunkSizeWarningLimit: 500,
    sourcemap: false,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
    rollupOptions: {
      output: {
        // Merge shared helper chunks under ~10 KB into their consumers instead of
        // emitting dozens of sub-kilobyte files (fewer requests per navigation).
        experimentalMinChunkSize: 10_000,
        manualChunks(id) {
          // Vite's `__vitePreload` helper (virtual module) is imported by every
          // chunk that uses dynamic import(). Left unassigned, rollup parks it in
          // whichever chunk claims it first — it landed in vendor-jspdf, which
          // made the 418 KB jsPDF chunk a hard dependency of the app shell. Pin
          // it to the chunk that is always loaded anyway.
          if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload-polyfill')) {
            return 'vendor-react';
          }
          // Keep the tiny useGoogleMaps hook next to the Maps SDK it wraps.
          // Otherwise experimentalMinChunkSize folds it into the big shared
          // helpers chunk and the 31 KB Maps vendor becomes a static dependency
          // of every page (it showed up on the login page).
          if (id.includes('@react-google-maps/api') || id.includes('/hooks/useGoogleMaps')) {
            return 'vendor-google-maps';
          }
          if (!id.includes('node_modules')) return;
          const vendorChunks: [string, string[]][] = [
            // Core React ecosystem
            ['vendor-react', ['react', 'react-dom', 'react-router-dom']],
            // Animation library (used heavily by avatars)
            ['vendor-motion', ['framer-motion']],
            // Backend services
            ['vendor-supabase', ['@supabase/supabase-js']],
            // Query persistence (IndexedDB) — keep out of main-index for bundle limit
            ['vendor-query-persist', ['@tanstack/react-query-persist-client', 'idb']],
            // Data fetching
            ['vendor-query', ['@tanstack/react-query']],
            // Form handling
            ['vendor-forms', ['react-hook-form', '@hookform/resolvers', 'zod']],
            // Utilities
            ['vendor-utils', ['date-fns', 'clsx', 'tailwind-merge']],
            // Icons: without this, rollup emits one ~600 B chunk per icon shared
            // across routes (160+ files), so every navigation fans out into a
            // waterfall of tiny requests. One ~25 KB gzip chunk, fetched once.
            ['vendor-icons', ['lucide-react']],
            // Heavy libs — separate chunks to avoid 500kB warning and improve caching
            ['vendor-jspdf', ['jspdf', 'jspdf-autotable']],
            ['vendor-xlsx', ['xlsx']],
            ['vendor-recharts', ['recharts']],
            ['vendor-react-pdf', ['@react-pdf/renderer']],
          ];
          for (const [chunk, packages] of vendorChunks) {
            for (const pkg of packages) {
              if (id.includes(`node_modules/${pkg}/`)) return chunk;
            }
          }
        },
        // Optimize chunk file names for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId || '';
          
          // BackgroundParticles gets its own chunk for lazy loading
          if (facadeModuleId.includes('BackgroundParticles')) {
            return 'assets/feature-particles-[hash].js';
          }
          // Admin pages get their own chunk
          if (facadeModuleId.includes('/pages/Admin')) {
            return 'assets/feature-admin-[hash].js';
          }
          // Avatar components get their own chunk for lazy loading
          if (facadeModuleId.includes('avatar') || facadeModuleId.includes('Avatar')) {
            return 'assets/avatars-[hash].js';
          }
          // Dashboard components
          if (facadeModuleId.includes('dashboard') || facadeModuleId.includes('Dashboard')) {
            return 'assets/dashboard-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      '@supabase/supabase-js', 
      'framer-motion',
      'react',
      'react-dom',
      '@tanstack/react-query',
      'lucide-react', // Include for better dev performance and tree-shaking
    ],
  },
  // Server optimizations for dev
  server: {
    // Pre-transform dependencies for faster page loads
    warmup: {
      clientFiles: [
        './src/pages/Dashboard.tsx',
        './src/pages/admin/AdminDashboard.tsx',
        './src/components/dashboard/DashboardAvatar.tsx',
        './src/components/avatars/**/*.tsx',
      ],
    },
  },
  esbuild: mode === 'production' ? {
    drop: ['console', 'debugger'],
    // Additional production optimizations
    legalComments: 'none',
    treeShaking: true,
  } : undefined,
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
};
});
