# Suggested commit groups

Run these in order. Each block is one commit. After running a block, run `git status` to confirm, then move to the next.

---

## 1. chore: ignore e2e and test report artifacts

```bash
git add .gitignore
git commit -m "chore: ignore test-results and e2e-report artifacts"
```

---

## 2. fix(security): RLS and storage migrations

```bash
git add supabase/migrations/20260124160000_fix_app_users_insert_privilege_escalation.sql
git add supabase/migrations/20260124170000_fix_announcements_rls_policies.sql
git add supabase/migrations/20260124170001_fix_equipment_inspections_update_policy.sql
git add supabase/migrations/20260124180000_add_storage_file_validation.sql
git commit -m "fix(security): RLS policies and storage file validation"
```

---

## 3. feat(db): certification system migrations

```bash
git add supabase/migrations/20260130100000_create_certification_system.sql
git add supabase/migrations/20260130100001_create_certification_rls_policies.sql
git add supabase/migrations/20260130100002_certification_rpc_functions.sql
git add supabase/migrations/20260130100003_add_tree_felling_jsa.sql
git add supabase/migrations/20260130100004_practical_evaluator_authorization.sql
git add supabase/migrations/20260130100005_seed_bucket_trimmer_certification.sql
git add supabase/migrations/20260130100006_certification_expiration_notifications.sql
git add supabase/migrations/20260130100007_certification_analytics_views.sql
git add supabase/migrations/20260130100008_add_short_answer_question_type.sql
git add supabase/migrations/20260130100009_seed_geoboy_certification.sql
git add supabase/migrations/20260130100010_seed_groundsman_certification.sql
git add supabase/migrations/20260130100011_seed_jarraff_certification.sql
git add supabase/migrations/20260130100012_seed_skidsteer_certification.sql
git add supabase/migrations/20260130100013_update_submit_test_for_short_answer.sql
git add supabase/migrations/20260130100014_submit_practical_evaluation_rpc.sql
git add supabase/migrations/20260131100000_abandon_certification_attempt_rpc.sql
git add supabase/migrations/20260201000000_increment_contact_template_usage_rpc.sql
git add supabase/migrations/20260202000000_certification_access_grants.sql
git add supabase/migrations/20260202100000_grant_certification_access_invoker.sql
git add supabase/migrations/20260203000000_certification_allow_all_users.sql
git add supabase/migrations/20260203100000_fix_certification_schema_sync.sql
git add supabase/migrations/20260204000000_admin_bypass_certification_cooldown.sql
git add supabase/migrations/20260205000000_seed_all_certification_questions.sql
git add supabase/migrations/20260205000001_fix_certification_categories.sql
git add supabase/migrations/20260205000002_fix_submission_score_calc.sql
git add supabase/migrations/20260205000003_fix_status_ambiguity.sql
git add supabase/migrations/20260205000004_add_answers_to_pending_reviews_view.sql
git add supabase/migrations/20260205000005_add_question_text_to_answers.sql
git add supabase/migrations/20260225100000_completion_stats_live.sql
git add supabase/migrations/20260225100001_refresh_completion_stats_on_graded.sql
git commit -m "feat(db): certification system and seed migrations"
```

---

## 4. feat(cert): certification UI, admin, and content

```bash
git add src/components/certifications/
git add src/components/content/
git add src/content/
git add src/pages/certifications/
git add src/pages/admin/AdminCertifications.tsx
git add src/pages/admin/AdminGradeTests.tsx
git add src/pages/ResourceDocView.tsx
git add src/hooks/useCertifications.ts
git add src/hooks/admin/
git add src/types/certifications.ts
git add src/types/ios.d.ts
git add src/assets/ATTS_Logo_stamped.png
git add supabase/functions/cert-expiration-reminder/
git add scripts/import-cert-questions.ts
git add scripts/bucket-trimmer-questions-sample.csv
git commit -m "feat(cert): certification UI, admin grade tests, and doc viewer"
```

---

## 5. feat(jsa): tree felling JSA and form improvements

```bash
git add src/pages/forms/TreeFellingJSAForm.tsx
git add src/pages/forms/JsaTypePicker.tsx
git add src/pages/forms/dailyJSAFormState.ts
git add src/pages/forms/dvir/sections/
git add src/hooks/jsa/useJSASubmission.ts
git commit -m "feat(jsa): tree felling JSA form and JSA type picker"
```

---

## 6. ci: GitHub workflows

```bash
git add .github/
git commit -m "ci: add GitHub workflows"
```

---

## 7. docs: plans, compliance, security

```bash
git add docs/
git commit -m "docs: plans, compliance summary, and security audit notes"
```

---

## 8. test: e2e and unit tests

```bash
git add tests/
git commit -m "test: e2e and unit tests, fixtures, and config"
```

---

## 9. fix: supabase edge functions

```bash
git add supabase/functions/admin-create-notification/
git add supabase/functions/check-compliance-9am/
git add supabase/functions/generate-fixes-summary/
git add supabase/functions/get-smart-defaults/
git add supabase/functions/notify-admins-new-signup/
git add supabase/functions/notifications-worker/
git add supabase/functions/push-subscribe/
git commit -m "fix: supabase edge function updates"
```

---

## 10. chore: build and tooling

```bash
git add package.json package-lock.json
git add vite.config.ts playwright.config.ts vitest.setup.ts
git add scripts/checkBundleSize.mjs
git add .lighthouse/manifest.json public/_headers index.html
git commit -m "chore: build, test, and tooling config"
```

---

## 11. refactor: app – remaining src and resources UX doc

```bash
git add src/
git add resources-documents-ux-findings.md
git status   # confirm only intended files
git commit -m "refactor: app-wide updates for certs, forms, dashboard, and UI"
```

---

**Note:** If you prefer fewer commits, you can merge e.g. 6+7+8 (ci and docs and tests) or 10+11 (tooling + app) into single commits. After the first commit, `test-results/` and `tests/e2e-report/` will no longer appear in `git status` (they're now ignored).
