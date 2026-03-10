# Project Configuration

## Metadata
Branch: main
HEAD: 7575596
Initialized: 2026-02-17
Governor: v3.2

## Stack
Framework: React 18.3.1 + TypeScript 5.9.3
Build: Vite 7.3.0
Styling: Tailwind CSS 3.4.1
Animation: Framer Motion 12.23.26
State (server): TanStack React Query 5.90.12
State (client): Zustand 5.0.9 + React Context
Forms: React Hook Form 7.68.0 + Zod 4.1.13
Router: react-router-dom 7.9.4
DB/Auth: Supabase (supabase-js 2.57.4)
Edge Functions: Deno (Supabase Functions)
PWA: vite-plugin-pwa 1.2.0 + Workbox 7.4.0
Offline: IndexedDB queue + photo blob store

## Testing
Unit: Vitest 4.0.14 (38 files)
Integration: Vitest (2 files)
E2E: Playwright 1.57.0 (27 files)
Accessibility: pa11y-ci + @axe-core/playwright
Lighthouse: @lhci/cli

## CI/CD
GitHub Actions: ci.yml (lint + typecheck + unit tests), e2e.yml (Playwright)

## Maturity: MATURE
- 525 source files (.ts/.tsx)
- 77 test files
- 170 SQL migrations
- Established patterns (React Query hooks, offline queue, form persistence)
- CI/CD configured
- Checkpoint every 5 items

## Roles (7)
employee, admin, manager, mechanic, general_foreman, safety_officer, foreman

## Available Specialists
- 10-specialist-ux.mdc (v3.1) ✅
- 11-specialist-workflow.mdc (v3.0) ✅
- 12-specialist-architecture.mdc (v2.2) ✅
- 13-specialist-performance.mdc (v2.2) ✅
- 14-specialist-qa.mdc (v2.2) ✅
- 15-specialist-security.mdc (v2.1) ✅

## Key Paths
Supabase client: src/lib/supabaseClient.ts
Offline queue: src/lib/offlineQueue.ts (isOnline(), addToQueue())
Offline photos: src/lib/offlinePhotoStore.ts
Auth context: src/contexts/AuthContext.tsx
Form persistence: src/hooks/useFormPersistence.ts
Query keys: src/lib/queryKeys.ts
Logger: src/lib/logger.ts (replaces console.*)
Toast: dual system (formToast for forms, Sonner for general)

## Verified Commands
Typecheck: npm run typecheck
Lint: npm run lint
Unit tests: npm run test:unit
E2E tests: npm run test:e2e
Build: npm run build
