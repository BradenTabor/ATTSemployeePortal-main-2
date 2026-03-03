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
    generateVersionFile(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // We'll handle registration manually
      manifest: false, // Use existing /public/manifest.json
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // emergency-action-plan.png is ~2.6 MB; allow up to 3 MiB for single assets
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
        manualChunks: {
          // Core React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation library (used heavily by avatars)
          'vendor-motion': ['framer-motion'],
          // Backend services
          'vendor-supabase': ['@supabase/supabase-js'],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
          // Query persistence (IndexedDB) — keep out of main-index for bundle limit
          'vendor-query-persist': ['@tanstack/react-query-persist-client', 'idb'],
          // Form handling
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Utilities
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
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
