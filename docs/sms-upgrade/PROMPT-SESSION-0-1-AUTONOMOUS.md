You are working in the ATTS Employee Portal repo on a scoped upgrade of the automated SMS pipeline (ClickSend + Supabase Edge Functions). This is a multi-session build. In this session you will (0) set up the project scaffolding, (1) run discovery and planning, and (2) build Chunk 1 ONLY IF the discovery gate passes. Work through the phases in order. Do not skip a gate.

PRE-CHECK. Confirm the folder docs/sms-upgrade/ exists and contains 00-BUILD-BRIEF.md, 10-CHANGE-REQUEST-AND-PRD.md, 11-COMPLIANCE-SOP.md, 12-PROJECT-SCOPE.md. If it does not, STOP immediately and reply only: "docs/sms-upgrade/ is missing — unzip sms-upgrade-docs.zip into the repo root and re-run." Do nothing else.

Read these before doing anything else, in this order:
@docs/sms-upgrade/00-BUILD-BRIEF.md
@docs/sms-upgrade/10-CHANGE-REQUEST-AND-PRD.md
@docs/sms-upgrade/12-PROJECT-SCOPE.md
@.cursor/skills/project-conventions/SKILL.md
@.cursor/skills/create-edge-function/SKILL.md
@.cursor/skills/create-supabase-migration/SKILL.md
@.cursor/skills/scaffold-admin-page/references/export-pattern.md
@docs/SMS_ESCALATION.md
@docs/PAYROLL_SMS_REMINDER.md

HARD CONSTRAINTS — apply to this session and every future session on this project:
- No live SMS, ever, from an agent session. You may READ from ClickSend (the clicksend MCP server's view-* tools, and scripts/clicksend-audit.sh) but you must never call the MCP send-sms tool, never POST to rest.clicksend.com, and never invoke an Edge Function without dryRun. Every new or modified send path must support the existing dryRun pattern ({"dryRun": true} body or x-dry-run: true header).
- Additive only. No DROP, RENAME, ALTER ... TYPE, or data rewrites against sms_escalation_send_log, mass_sms_log, payroll_reminder_sms_log, or app_users.
- No changes to safety-briefing overdue/tiering/suppression business logic.
- Recipients are employees/crew only — never add a customer-facing send path.
- Exclude test accounts (email NOT ILIKE '%@atts.test%') in any new query.
- New migration filenames must sort after 20260627170000 (use 202609DDHHMM00_ prefix).
- Never commit to main. All work happens on branch feat/sms-upgrade. Never force-push.
- Gates after every code change: npm run lint && npm run typecheck && npm run build must all pass. If a gate fails, fix it before moving on; if you cannot fix it in 3 attempts, stop and report.
- Use logger.* not console.*; follow the two-toast rule; use @/ imports — per project-conventions.

=== PHASE 0 — SCAFFOLDING ===

0.1 Create branch: from an up-to-date main, `git checkout -b feat/sms-upgrade`. Commit docs/sms-upgrade/ with message "docs(sms): planning docs for SMS pipeline upgrade".

0.2 Create a project skill at .cursor/skills/sms-upgrade/SKILL.md following the frontmatter format used by the existing skills in .cursor/skills/ (name, description, triggers, version, reviewed). Triggers: "sms", "clicksend", "opt-out", "sms log", "sms export", "sender number", "heat alert sms", "cert expiry sms". Body: the HARD CONSTRAINTS above verbatim, the "Where things live today" tables from 00-BUILD-BRIEF.md, and the chunk list. Purpose: every future session auto-loads the ground rules without re-reading the whole brief. Add it to .cursor/skills/SKILLS_README.md in the same style as the existing entries.

0.3 Create .cursor/rules/20-sms-upgrade.mdc with alwaysApply: false and globs limited to: supabase/functions/_shared/clicksend.ts, supabase/functions/*sms*/**, supabase/functions/clicksend-*/**, supabase/migrations/*sms*, src/components/admin/ComplianceDataExportPanel.tsx. Content: the HARD CONSTRAINTS only, under 200 words. Register it in .cursor/rules/README.md in the same style as the existing entries.

0.4 Move docs/sms-upgrade/clicksend-audit.sh to scripts/clicksend-audit.sh, `chmod +x` it, and add `docs/sms-upgrade/clicksend-audit-*.json` to .gitignore (the output contains phone numbers). Commit: "chore(cursor): sms-upgrade skill, scoped rule, clicksend audit script". Run the gates (nothing should have changed, but confirm).

=== PHASE 1 — DISCOVERY & PLANNING (no application code changes in this phase) ===

The brief was written from a read-only review by an outside reviewer who could NOT see Supabase secrets, the live database, or the ClickSend account. Verify it against the real code.

1.1 VERIFY EVERY FINDING in 00-BUILD-BRIEF.md "Where things live today" and in section A.3 of the Change Request: mark each CONFIRMED / PARTIALLY CORRECT / WRONG with file:line evidence. Pay special attention to the two items marked HYPOTHESIS. Do not soften a wrong finding.

1.2 INVENTORY (path + line numbers):
   a. every call site of sendSMS() from supabase/functions/_shared/clicksend.ts and what `from` each resolves to;
   b. every place app_users.phone_number is written (migrations, edge functions, frontend hooks);
   c. every place sms_operational_opt_out / sms_marketing_opt_out is READ, and any send path that does NOT check the relevant flag;
   d. exact current columns of sms_escalation_send_log, mass_sms_log, payroll_reminder_sms_log from supabase/.localgate/prod_schema.sql and the migrations — flag drift;
   e. any existing Edge Function that receives an external webhook and its auth pattern;
   f. the exact ExportColumn / DataExporter API shape used by ComplianceDataExportPanel.tsx.

1.3 DESIGN CHECK on the 6 items under "Target architecture" in the brief: agree / disagree-with-reason, plus any repo-specific constraint the brief missed. Answer explicitly: should per-recipient logging live inside _shared/clicksend.ts or in a wrapper each function calls, given how the four existing functions batch messages?

1.4 PLAN CHUNK 1 in detail: migration filename(s) and full SQL; files changed and how; how dry-run rows are distinguished from real sends in the log; RLS policy (reuse the existing is_admin() pattern); the proof-of-no-behavior-change method (dry-run before/after comparison of eligible counts and message bodies per function); rollback steps. Then a one-paragraph outline each for Chunks 2–7.

1.5 CLICKSEND ACCOUNT FACTS (read-only). Run `./scripts/clicksend-audit.sh > docs/sms-upgrade/clicksend-audit-$(date +%F).json`. If it exits 2 (no credentials), also try the clicksend MCP server tools view-sms-history, view-sms-statistics, and view-contact-lists. From whichever works, answer: (a) which `from` numbers appear in real outbound history and how often — this resolves the "two numbers" HYPOTHESIS; (b) the dedicated numbers on the account (/v3/numbers); (c) whether an opt-out contact list exists and how many contacts are in it — then cross-check those phone numbers against app_users.phone_number in supabase/.localgate/prod_schema.sql seed data if any, and note that a live-DB cross-check is needed; (d) the account's recent inbound messages — count how many are STOP. Do NOT paste raw phone numbers into the report; use counts and the last 4 digits. If neither method works, write "ClickSend read access unavailable in this session" and continue. Note: US A2P 10DLC registration status is not exposed by the ClickSend API; record it as "confirm in dashboard / with ClickSend support".

1.6 Write all of the above to docs/sms-upgrade/01-DISCOVERY-REPORT.md with these H2 headings exactly: "Findings verification", "Inventory", "ClickSend account facts", "Design check", "Chunk 1 plan", "Chunks 2-7 outline", "Open questions for Braden", "Blockers". Commit: "docs(sms): discovery report".

GATE. Proceed to Phase 2 only if ALL of the following are true: (i) zero findings marked WRONG that affect Chunk 1's design, (ii) the "Blockers" section is empty, (iii) the design check agrees with items 1 (unified log) and its logging location decision is made. If the gate fails, skip Phase 2 and go straight to REPORTING.

=== PHASE 2 — BUILD CHUNK 1 (only if the gate passed) ===

Chunk 1 = unified sms_message_log table (one row per recipient per send) + backward-compatible view over the three legacy tables + per-recipient logging on every existing send path, with ZERO change to which messages are sent, to whom, or when.

2.1 `git commit --allow-empty -m "checkpoint: before chunk 1"`.
2.2 Implement exactly the Chunk 1 plan from 01-DISCOVERY-REPORT.md using the create-supabase-migration and create-edge-function skills. Log rows must record: user_id (nullable), phone_e164, message_type, category (operational|marketing), from_number, body or template_key, provider_message_id, provider_status, price, opt_out_state_at_send (jsonb), run_id linking to the legacy per-run row where one exists, is_dry_run (boolean), sent_at.
2.3 Add a Deno unit test for the logging helper and, if the repo's e2e conventions allow it without live services, a test asserting the compat view returns rows from all three legacy tables. Use the add-e2e-test skill conventions.
2.4 Run the gates. Then run each of the four SMS functions' dry-run path locally if the repo's tooling supports it (see scripts/test-payroll-sms-reminder.sh for the pattern) and record before/after eligible counts and sample message bodies in docs/sms-upgrade/02-CHUNK1-VERIFICATION.md. If local dry-run is not possible, say so explicitly in that file rather than claiming it was done.
2.5 Update docs/cron-jobs-inventory.md and docs/SMS_ESCALATION.md / docs/PAYROLL_SMS_REMINDER.md only where the new logging changes what an operator would see. Do not rewrite them.
2.6 Commit: "feat(sms): unified sms_message_log + per-recipient logging (chunk 1, dry-run safe)". Push branch feat/sms-upgrade. If the gh CLI is available and authenticated, open a DRAFT pull request titled "SMS pipeline upgrade — Chunk 1: unified message log" whose body links docs/sms-upgrade/01-DISCOVERY-REPORT.md and 02-CHUNK1-VERIFICATION.md and lists rollback steps. If gh is not available, skip the PR and say so.

Do NOT start Chunk 2. Do NOT deploy any Edge Function or apply any migration to a remote Supabase project. Do NOT modify Supabase secrets or ClickSend configuration.

=== REPORTING ===

Write docs/sms-upgrade/03-SESSION-LOG.md (append-only across sessions; create it now) with: date, phases completed, gate result and why, commits made (hashes), PR URL if any, gates status, and anything you were unsure about. Then reply in chat with ONLY:
(a) Phase 0 done? Phase 1 done? Gate passed? Phase 2 done?
(b) CONFIRMED / PARTIAL / WRONG counts from the findings verification
(c) the 3 most important things the brief got wrong or missed
(d) the "Open questions for Braden" list verbatim
(e) branch name, commit hashes, PR URL
(f) one sentence: what you recommend happens next.
