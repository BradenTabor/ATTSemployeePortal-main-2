import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // We'll handle registration manually
      manifest: false, // Use existing /public/manifest.json
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
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
      'jspdf': path.resolve(__dirname, 'node_modules/jspdf/dist/jspdf.es.min.js'),
    },
  },
  build: {
    minify: 'esbuild',
    // Reduced from 800kb to 500kb for stricter chunk size monitoring
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
    ],
    exclude: ['lucide-react'],
  },
  // Server optimizations for dev
  server: {
    // Pre-transform dependencies for faster page loads
    warmup: {
      clientFiles: [
        './src/pages/Dashboard.tsx',
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
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
