---
name: sms-upgrade
description: Ground rules, file map, and chunk list for the ATTS ClickSend SMS pipeline upgrade. Load before any SMS, ClickSend, opt-out, SMS log, SMS export, sender number, heat-alert SMS, or cert-expiry SMS work.
triggers:
  - "sms"
  - "clicksend"
  - "opt-out"
  - "sms log"
  - "sms export"
  - "sender number"
  - "heat alert sms"
  - "cert expiry sms"
version: 1.0
reviewed: 2026-09-02
---

# SMS Pipeline Upgrade

## HARD CONSTRAINTS

- No live SMS, ever, from an agent session. You may READ from ClickSend (the clicksend MCP server's view-* tools, and scripts/clicksend-audit.sh) but you must never call the MCP send-sms tool, never POST to rest.clicksend.com, and never invoke an Edge Function without dryRun. Every new or modified send path must support the existing dryRun pattern ({"dryRun": true} body or x-dry-run: true header).
- Additive only. No DROP, RENAME, ALTER ... TYPE, or data rewrites against sms_escalation_send_log, mass_sms_log, payroll_reminder_sms_log, or app_users.
- No changes to safety-briefing overdue/tiering/suppression business logic.
- Recipients are employees/crew only — never add a customer-facing send path.
- Exclude test accounts (email NOT ILIKE '%@atts.test%') in any new query.
- New migration filenames must sort after 20260627170000 (use 202609DDHHMM00_ prefix).
- Never commit to main. All work happens on branch feat/sms-upgrade. Never force-push.
- Gates after every code change: npm run lint && npm run typecheck && npm run build must all pass. If a gate fails, fix it before moving on; if you cannot fix it in 3 attempts, stop and report.
- Use logger.* not console.*; follow the two-toast rule; use @/ imports — per project-conventions.

## Where things live today

### Sending
| What | Path | Notes |
|---|---|---|
| Shared ClickSend helper | `supabase/functions/_shared/clicksend.ts` | `sendSMS(messages, {username,password,from})` → POST `https://rest.clicksend.com/v3/sms/send`; returns per-message `status`, `messageId`, `price`; treats `SUCCESS` and `THROTTLED` as success. Unified logging wrapper: `sendAndLogSMS()`. |
| Safety briefing reminder (Tier 0) | `supabase/functions/safety-briefing-reminder-sms/index.ts` | Mon–Fri 10:40 UTC. Default from `+18443781444`. |
| Safety briefing escalation (Tier 1/2) | `supabase/functions/safety-briefing-escalation-sms/index.ts` | Mon–Fri 16:00 UTC. Four `sendSMS`/`sendAndLogSMS` call sites. Default from `+18443781444`. |
| Payroll hours reminder | `supabase/functions/payroll-hours-reminder-sms/index.ts` | Thu/Fri/Sat 8 AM Central. Default from `+18443781444`. Kill switch `app_settings.payroll_reminder_sms_config`. |
| Admin mass SMS | `supabase/functions/send-mass-sms/index.ts` | Admin JWT; dry-run by default; 15-min cooldown; batches of 500. Default `from` is `""` (unset). |
| Cron inventory | `docs/cron-jobs-inventory.md`, `scripts/deploy-cron-auth.sh` | All HTTP cron jobs need the service-role Bearer injected. |
| Read-only ClickSend audit | `scripts/clicksend-audit.sh` | GET only. Output gitignored as `docs/sms-upgrade/clicksend-audit-*.json`. |

### Logging
| Table | Created by | Shape |
|---|---|---|
| `sms_message_log` | `20260902200000_sms_message_log.sql` | One row per recipient per send (Chunk 1). |
| `sms_message_log_compat` | same migration | View: new table UNION ALL unnested legacy rows with no matching `run_id`. |
| `sms_escalation_send_log` | `20260310000005_…`, extended by `20260310120000_…` and `20260310130000_…` | One row per run per tier. |
| `mass_sms_log` | `20260320120000_sms_opt_out_and_mass_sms_log.sql` | One row per blast. **No per-recipient rows.** |
| `payroll_reminder_sms_log` | `20260521120000_payroll_hours_reminder_sms.sql` | One row per (date, tier) slot; RPC `claim_payroll_reminder_sms_log(date, tier)`. |
| `payroll_sms_cron_monitoring` | `20260521130000_…` | Cron run monitoring. |
| Schema snapshot | `supabase/.localgate/prod_schema.sql` | Confirm exact current columns before writing SQL. |

### Opt-out / consent state
| Field | Added by | Meaning |
|---|---|---|
| `app_users.sms_marketing_opt_out` | `20260320120000_…` | Excluded from admin mass SMS. |
| `app_users.sms_operational_opt_out` | `20260521120000_…` | Honored by payroll. Reminder + escalation do **not** read it (do not change in Chunk 1). |
| `app_users.phone_number` | `20260308100000_…`; normalized `20260310130003_…`; backfilled `20260320120001_…` | No consent record exists. |
| Escalation static recipients | `sms_escalation_recipients` (tier 2) | E.164, `is_active`. No `user_id`. |

## Chunk list

- **Chunk 1** unified log table + compat view + per-recipient logging via `sendAndLogSMS` (no change to who/when/what is sent).
- **Chunk 2** export section in `ComplianceDataExportPanel.tsx` + e2e test.
- **Chunk 3** inbound webhook + opt-out events + nightly reconciliation (dry-run diff first).
- **Chunk 4** sender registry + remove hardcoded `from` fallbacks.
- **Chunk 5** consent records + UI.
- **Chunk 6** cert-expiry SMS.
- **Chunk 7** heat-index SMS.

Planning docs: `docs/sms-upgrade/`. Discovery: `docs/sms-upgrade/01-DISCOVERY-REPORT.md`.
