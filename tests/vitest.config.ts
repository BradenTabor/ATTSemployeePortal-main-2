/**
 * Vitest Configuration for Unit Tests
 * 
 * Separate configuration for the tests directory.
 * Uses the same setup as the main vitest.setup.ts.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../vitest.setup.ts'],
    include: [
      './unit/**/*.test.ts',
      './unit/**/*.test.tsx',
    ],
    exclude: [
      './e2e/**/*',
      './node_modules/**/*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/pages/forms/**/*.tsx',
        'src/components/forms/**/*.tsx',
        'src/lib/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/index.ts',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@tests': path.resolve(__dirname, '.'),
    },
  },
});
