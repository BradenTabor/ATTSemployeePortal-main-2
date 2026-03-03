# Agent Instructions

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- Basically just SOPs written in Markdown, live in `directives/`
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings
- You're the glue between intent and execution. E.g you don't try scraping websites yourself—you read `directives/scrape_website.md` and come up with inputs/outputs and then run `execution/scrape_single_site.py`

**Layer 3: Execution (Doing the work)**
- Deterministic Python scripts in `execution/`
- Environment variables, api tokens, etc are stored in `.env`
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

## Operating Principles

**1. Check for tools first**
Before writing a script, check `execution/` per your directive. Only create new scripts if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)
- Update the directive with what you learned (API limits, timing, edge cases)
- Example: you hit an API rate limit → you then look into API → find a batch endpoint that would fix → rewrite script to accommodate → test → update directive.

**3. Update directives as you learn**
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations—update the directive. But don't create or overwrite directives without asking unless explicitly told to. Directives are your instruction set and must be preserved (and improved upon over time, not extemporaneously used and then discarded).

## Self-annealing loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the tool
3. Test tool, make sure it works
4. Update directive to include new flow
5. System is now stronger

## File Organization

**Deliverables vs Intermediates:**
- **Deliverables**: Google Sheets, Google Slides, or other cloud-based outputs that the user can access
- **Intermediates**: Temporary files needed during processing

**Directory structure:**
- `.tmp/` - All intermediate files (dossiers, scraped data, temp exports). Never commit, always regenerated.
- `execution/` - Python scripts (the deterministic tools)
- `directives/` - SOPs in Markdown (the instruction set)
- `.env` - Environment variables and API keys
- `credentials.json`, `token.json` - Google OAuth credentials (required files, in `.gitignore`)

**Key principle:** Local files are only for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in `.tmp/` can be deleted and regenerated.

## Summary

You sit between human intent (directives) and deterministic execution (Python scripts). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.

## Learned User Preferences

- Prefers action over explanation — when given a plan, just execute it; don't walk through steps or ask "should I proceed?"
- "continue" means pick the best next step and proceed without asking for clarification
- Pasting errors, test output, or DOM paths is an implicit "fix this now" — diagnose and fix immediately
- "GO: AUTOPILOT FULL" is the primary command to trigger the Governor audit-and-fix cycle
- Expects comprehensive audits followed by bulk fixes in one pass, not incremental check-ins
- Lint, typecheck, and build must pass after every change — these are hard gates (`npm run lint`, `npm run typecheck`, `npm run build`)
- After fixes, rerun only the previously failing tests, not the full suite
- Prefers concise, structured explanations — "simply explain what you changed" means plain bullet points, not walls of text
- Prefers aggressive time estimates over conservative ones; account for existing infrastructure
- Screenshots with DOM paths are bug reports — parse the path, locate the component, fix the visual issue
- Uses voice transcription — messages may contain filler words ("um", "uh"); parse intent without asking about grammar
- Expects visual browser verification of UI changes on both desktop and mobile viewports
- Cares deeply about visual polish — glassmorphism, gradients, animations must match the dark theme system
- Follows specific design instructions exactly when given (exact colors, animations, positions)
- When `npx supabase db push` fails due to remote migration mismatch, apply migrations via Supabase MCP as fallback
- Respects reverts silently — when user reverts a change, acknowledge it and never re-add the removed code
- Complete at minimum 5 backlog items before providing an autopilot status update
- Expects comprehensive plans with file paths, component names, and concrete code examples before implementation
- Prefers structured multiple-choice questions (AskQuestion format) over open-ended clarification
- Be ready to explain technical concepts in plain language without assuming deep technical fluency
- Offline mode is a critical product priority — treat offline-related issues with high urgency
- All safety compliance forms must follow consistent patterns across DVIR, JSA, Equipment, and RTO

## Learned Workspace Facts

- ATTS Employee Portal is a PWA for All Terrain Tree Service (alltts.com), a tree services/utility contractor
- Stack: React 18.3, TypeScript 5.9, Vite 7.3, Supabase (Auth + Postgres + RLS + Edge Functions + Storage), TanStack Query 5, Tailwind CSS 3.4, Framer Motion 12, Zustand 5, React Hook Form 7, Zod 4
- Deployed on Vercel with Speed Insights; PWA via vite-plugin-pwa with Workbox
- Seven user roles: employee, admin, manager, mechanic, general_foreman, safety_officer, foreman — each with distinct RLS policies and UI theming
- Core safety forms: DVIR, Daily JSA (6-step wizard), Tree Felling JSA, Daily Equipment Inspection, RTO, Near Miss Report
- Forms follow a 6-file architecture: state file, validation hook, submission hook, photo hook, page component, E2E stub
- Dark theme with glassmorphism: bg-white/[0.03], border-white/10, rounded-xl; gold for admin, ember/red for mechanic, blue for foreman, purple for general_foreman
- Timezone: America/Chicago for all date operations and cron jobs
- Offline-first: offlinePhotoStore, offlineQueue, OfflineQueueContext via IndexedDB; no TTL on queue data; Supabase refresh token (~7 days) is the hard limit
- OSHA compliance: 300 Log, 300A Summary, 301 Incident Report, ITA CSV export; regulatory standards: 49 CFR 396, OSHA 29 CFR 1904/1910/1926, ANSI Z133/S390.1/B71.4
- Certification system: 5 types (Bucket Trimmer, Geo-Boy, Groundsman, Jarraff Trimmer, Skid Steer), 80% passing, 24h retry cooldown, 1-year validity
- Supabase project ref: emqqxfzahmwnehxcpxzp ("ATTS portal APP 2")
- Autopilot Governor: .cursor/rules/00-autopilot-governor.mdc + 6 specialist rules (UX, Workflow, Architecture, Performance, QA, Security); state in docs/cursor-agents/ (backlog.md, scores.md, changelog.md)
- Testing: Playwright E2E (tests/e2e/), Vitest unit (tests/unit/), loginAs() auth helper, data-testid selectors; E2E must dismiss "What's New" modal (atts_onboarding_completed_version localStorage key)
- Dev server runs on localhost:5173 or :5174
- Migration naming: YYYYMMDDHHMMSS_description.sql in supabase/migrations/
- Query key registry: src/lib/queryKeys.ts — all TanStack Query keys registered centrally
- Edge Functions use // @ts-nocheck for Deno compatibility; tsconfig.json excludes supabase/**
- AnimatePresence must stay always mounted; render children conditionally inside with a stable key prop
- DVIR truck number is a select dropdown, not a text input — E2E tests must use selectOption(), not fill()
- Modals should portal to document.body via createPortal to avoid z-index/overflow clipping
- Accessibility: focus-visible:outline-emerald-400, aria-hidden on decorative icons, role="alert" on validation summaries
- Custom Tailwind breakpoint: xs: 375px defined alongside default sm/md/lg/xl
- Primary users are field workers — mobile-first, voice-to-text via Web Speech API (VoiceInputButton component)
- Target devices: iPhone 13+ (P0), iPhone SE / Samsung Galaxy (P1), iPad (P2), Desktop Chrome (P2)
- Cron schedule: Daily Safety Announcement (6 AM CST M-F, matches reward claim 6–8 AM), Daily Compliance Check (9 AM CST M-F), Weekly Safety Forecast (Sun 7 AM CST), Weekly Safety Audit Report (Fri 5 PM CST)
- Auth: Supabase Auth + app_users table for roles; profile cached in localStorage with 24h TTL; Edge Functions must pass Authorization header explicitly
- Centralized logger: src/lib/logger.ts with redactUserId() for PII-safe logging
- Smart Defaults edge function (get-smart-defaults) pre-fills form fields from user's historical submissions
- Unicode sanitization: unpaired surrogates stripped from JSA span fields before Supabase insertion
- Form draft debounce: 300ms; form persistence via useFormPersistence hook to IndexedDB/localStorage
- Large components refactored into sub-directories with barrel exports (e.g., admin-jsa/, dvir/sections/)
- Multi-language (Spanish) was built then reverted; app_users.preferred_language exists but is unused
- PostgreSQL enum gotcha: cannot use a newly added enum value in the same transaction — split into separate migrations
- Remote migration mismatch: Supabase remote has migrations not in local repo; apply via MCP as fallback
- Announcements sort by date column (publication date), not created_at
- Mileage validation: odometer must be >= previous reading (not strictly >)
- Responsive sizing: prefer CSS clamp() with vw units over breakpoint-only Tailwind classes for viewport-scaled elements
