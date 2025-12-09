import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Enable Fast Refresh for better dev experience
      fastRefresh: true,
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
    chunkSizeWarningLimit: 800,
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
