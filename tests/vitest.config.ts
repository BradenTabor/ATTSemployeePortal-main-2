/**
 * Vitest Configuration for Unit Tests
 * 
 * Separate configuration for the tests directory.
 * Uses the same setup as the main vitest.setup.ts.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const testsDir = __dirname;

export default defineConfig({
  root: path.resolve(testsDir, '..'),
  plugins: [react()],
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
    ],
    exclude: [
      'tests/e2e/**/*',
      '**/node_modules/**',
    ],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
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
      '@': path.resolve(testsDir, '../src'),
      '@tests': testsDir,
    },
  },
});
