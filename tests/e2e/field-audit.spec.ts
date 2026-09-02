/**
 * Field Safety Audit — E2E
 *
 * Chunk 3 Step 1 (test-first): validates the Chunk 2 draft-resume guarantee by
 * EXECUTION before the subject tray + checklist stack on it.
 *
 * Draft model (D1): "Start audit" inserts the field_audits row server-side; the
 * active auditId is held in localStorage ONLY as a crash/reload pointer. The
 * guarantee under test: reloading an in-progress audit RESUMES the same server
 * row and NEVER creates a duplicate. We assert the UI resume (same id, no start
 * form) AND the server truth (exactly one row, by a unique location marker)
 * across the reload, then discard for a clean lifecycle.
 *
 * Submit pipeline (Sep 2026): the review panel computes readiness client-side
 * (fieldAuditReadiness.ts) and the submit_field_audit RPC re-validates server-
 * side, stamps submitted_at, and returns the rollup the receipt renders from.
 * Submitted audits are locked by RLS; only an admin can reopen one.
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAs, dismissOnboardingIfPresent } from './helpers/auth';
import { getSupabaseAdmin, hasAdminEnv } from './helpers/supabaseAdmin';

const FIELD_AUDIT_PATH = '/safety-officer/field-audit';

/** A valid 1×1 PNG — exercises the real validate → compress → upload path. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Poll an async predicate until it returns a truthy value or the timeout elapses. */
async function pollUntil<T>(
  fn: () => Promise<T | null>,
  timeoutMs = 30_000,
  intervalMs = 1_000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() - start > timeoutMs) {
      throw new Error('pollUntil: condition not met before timeout');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/**
 * Dismiss the full-screen overlay toast (e.g. the "Audit started" success card),
 * which renders fixed/inset-0 over the page and intercepts clicks until closed.
 */
async function dismissOverlay(page: Page): Promise<void> {
  const portal = page.locator('#toast-overlay-portal');
  // The primary dismiss button's accessible name is always "Continue" (hardcoded
  // aria-label), present on success/error/info but not the loading state.
  await page
    .getByRole('button', { name: 'Continue', exact: true })
    .click({ timeout: 15_000 })
    .catch(() => {
      /* already auto-dismissed — fall through to the gone-assertion */
    });
  await expect(portal.getByRole('alert')).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Discard the active draft through its confirmation dialog and wait for the
 * Start form to come back. Discard is destructive, so the page gates it behind
 * FieldAuditConfirmDialog (danger tone).
 */
async function discardDraft(page: Page): Promise<void> {
  await page.getByTestId('field-audit-discard-btn').click();
  const dialog = page.getByTestId('field-audit-discard-confirm');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('field-audit-discard-confirm-confirm').click();
  await expect(page.getByTestId('field-audit-start-form')).toBeVisible({ timeout: 20_000 });
}

test.describe('Field Audit — draft resume guarantee', () => {
  // The duplicate-row assertion needs service-role DB access.
  test.skip(!hasAdminEnv(), 'Requires Supabase service-role env (.env) for DB assertions');

  test('reload resumes the same server auditId and creates no duplicate row', async ({ page }) => {
    test.setTimeout(90_000);
    const admin = getSupabaseAdmin();

    // Unique per-run marker stored in location_text — isolates this run's row(s)
    // from any other test/user data so the count assertion is unambiguous.
    const marker = `E2E-resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const countRows = async (): Promise<{ id: string; status: string }[]> => {
      const { data, error } = await admin
        .from('field_audits')
        .select('id, status')
        .eq('location_text', marker);
      expect(error, error?.message).toBeNull();
      return (data ?? []) as { id: string; status: string }[];
    };

    // Pre-clean (paranoia; marker is unique) + guaranteed teardown.
    await admin.from('field_audits').delete().eq('location_text', marker);

    try {
      await loginAs(page, 'safety_officer');
      await page.goto(FIELD_AUDIT_PATH);
      await dismissOnboardingIfPresent(page);

      // Fresh context → no pointer → the Start form renders.
      await expect(page.getByTestId('field-audit-start-form')).toBeVisible({ timeout: 20_000 });

      // Start the audit using location_text (satisfies work_site OR location CHECK).
      await page.getByTestId('field-audit-location').fill(marker);
      await page.getByTestId('field-audit-start-btn').click();

      // Draft created → resume card replaces the start form.
      const resumeCard = page.getByTestId('field-audit-resume');
      await expect(resumeCard).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('field-audit-start-form')).toHaveCount(0);

      // Server truth: exactly one draft row carries our marker.
      const afterStart = await countRows();
      expect(afterStart, 'exactly one field_audits row after Start').toHaveLength(1);
      const auditId = afterStart[0].id;
      expect(afterStart[0].status).toBe('draft');

      // UI is bound to that specific server row (short id is rendered #xxxxxxxx).
      const shortId = auditId.slice(0, 8);
      await expect(resumeCard).toContainText(`#${shortId}`);

      // ── The crux: reload, then re-check both UI and server ──────────────────
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await dismissOnboardingIfPresent(page);

      // Resumed (not a fresh Start form), same id.
      const resumeCardAfter = page.getByTestId('field-audit-resume');
      await expect(resumeCardAfter).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('field-audit-start-form')).toHaveCount(0);
      await expect(resumeCardAfter).toContainText(`#${shortId}`);

      // No duplicate created on reload — still exactly one row, same id.
      const afterReload = await countRows();
      expect(afterReload, 'still exactly one row after reload (no duplicate)').toHaveLength(1);
      expect(afterReload[0].id).toBe(auditId);

      // Clean lifecycle: discard (confirmed) returns to the Start form and removes the row.
      await discardDraft(page);
      const afterDiscard = await countRows();
      expect(afterDiscard, 'row removed after discard').toHaveLength(0);
    } finally {
      // Safety net if the test failed before discarding.
      await admin.from('field_audits').delete().eq('location_text', marker);
    }
  });

  test('records P/F/NA + ad-hoc + photo on an equipment subject (live upsert)', async ({ page }) => {
    test.setTimeout(120_000);
    const admin = getSupabaseAdmin();

    const marker = `E2E-checklist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const failNote = `Single-hand grip near MAD (${marker})`;
    const adHocLabel = `Ad-hoc finding ${marker}`;

    interface ItemRow {
      result: 'pass' | 'fail' | 'na';
      note: string | null;
      photo_path: string | null;
      custom_label: string | null;
      checklist_item_id: string | null;
    }

    // Seeded item id → item_key (config rarely changes) so we can assert by key.
    const { data: cfg, error: cfgErr } = await admin
      .from('audit_checklist_items')
      .select('id, item_key');
    expect(cfgErr, cfgErr?.message).toBeNull();
    const keyById = new Map(
      ((cfg ?? []) as { id: string; item_key: string }[]).map((c) => [c.id, c.item_key]),
    );

    const getAuditId = async (): Promise<string | null> => {
      const { data } = await admin
        .from('field_audits')
        .select('id')
        .eq('location_text', marker)
        .maybeSingle();
      return ((data?.id as string | undefined) ?? null) || null;
    };

    await admin.from('field_audits').delete().eq('location_text', marker);

    let photoPath: string | null = null;
    try {
      await loginAs(page, 'safety_officer');
      await page.goto(FIELD_AUDIT_PATH);
      await dismissOnboardingIfPresent(page);

      // Start the audit (location marker satisfies the work_site/location CHECK).
      await expect(page.getByTestId('field-audit-start-form')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('field-audit-location').fill(marker);
      await page.getByTestId('field-audit-start-btn').click();

      await expect(page.getByTestId('field-audit-resume')).toBeVisible({ timeout: 20_000 });

      // "Audit started" renders as a full-screen overlay toast — close it before
      // touching the tray, or it intercepts the first click.
      await dismissOverlay(page);

      const tray = page.getByTestId('field-audit-subjects-tray');
      await expect(tray).toBeVisible({ timeout: 20_000 });

      // ── Add an equipment subject (chainsaw → free-text unit number) ──────────
      await page.getByTestId('field-audit-equipment-type').selectOption('chainsaw');
      const unitInput = page.getByTestId('field-audit-equipment-number');
      await expect(unitInput).toBeVisible();
      await unitInput.fill('E2E-SAW-1');
      await page.getByTestId('field-audit-add-equipment-btn').click();

      // Chainsaw containment surfaces the seeded checklist (expanded by default).
      const passGroup = page.getByRole('radiogroup', { name: 'Saw started safely' });
      await expect(passGroup).toBeVisible({ timeout: 20_000 });

      // P on saw_start.
      await passGroup.getByRole('radio', { name: 'Pass', exact: true }).click();

      // F on saw_grip_footing → required note + photo (in-memory map → upload at save).
      const failGroup = page.getByRole('radiogroup', { name: 'Two-hand grip' });
      await failGroup.getByRole('radio', { name: 'Fail', exact: true }).click();
      const note = page.getByLabel('Finding note');
      await expect(note).toBeVisible();
      await note.fill(failNote);
      await note.press('Tab');
      await tray.locator('input[type="file"]').setInputFiles({
        name: 'finding.png',
        mimeType: 'image/png',
        buffer: TINY_PNG,
      });

      // N/A on saw_kickback.
      const naGroup = page.getByRole('radiogroup', { name: 'Kickback-zone awareness' });
      await naGroup.getByRole('radio', { name: 'N/A', exact: true }).click();

      // Ad-hoc "+ Add item": custom label, then Pass.
      await page.getByTestId('field-audit-add-item').click();
      const adHocInput = page.getByLabel('Custom item label');
      await expect(adHocInput).toBeVisible();
      await adHocInput.fill(adHocLabel);
      const adHocGroup = page.getByRole('radiogroup', { name: adHocLabel });
      await adHocGroup.getByRole('radio', { name: 'Pass', exact: true }).click();

      // ── Server truth: every action upserted live (D1) ───────────────────────
      const auditId = await pollUntil(getAuditId);
      expect(auditId, 'audit row exists by marker').toBeTruthy();

      const byKey = (rows: ItemRow[], k: string) =>
        rows.find((r) => r.checklist_item_id && keyById.get(r.checklist_item_id) === k);

      const rows = await pollUntil(async () => {
        const { data, error } = await admin
          .from('field_audit_items')
          .select('result, note, photo_path, custom_label, checklist_item_id')
          .eq('field_audit_id', auditId);
        expect(error, error?.message).toBeNull();
        const list = (data ?? []) as unknown as ItemRow[];
        const fail = byKey(list, 'saw_grip_footing');
        const adhoc = list.find((r) => r.custom_label === adHocLabel);
        const ready =
          byKey(list, 'saw_start')?.result === 'pass' &&
          fail?.result === 'fail' &&
          Boolean(fail?.note) &&
          Boolean(fail?.photo_path) &&
          byKey(list, 'saw_kickback')?.result === 'na' &&
          adhoc?.result === 'pass';
        return ready ? list : null;
      });

      expect(byKey(rows, 'saw_start')?.result).toBe('pass');

      const failRow = byKey(rows, 'saw_grip_footing');
      expect(failRow?.result).toBe('fail');
      expect(failRow?.note).toContain(marker);
      expect(failRow?.photo_path, 'fail row carries an uploaded photo').toBeTruthy();
      photoPath = failRow?.photo_path ?? null;

      expect(byKey(rows, 'saw_kickback')?.result).toBe('na');

      const adHocRow = rows.find((r) => r.custom_label === adHocLabel);
      expect(adHocRow?.result).toBe('pass');
      expect(adHocRow?.checklist_item_id, 'ad-hoc row has no seeded item').toBeNull();

      // Clean lifecycle: discard (confirmed) returns to Start (cascades subjects + items).
      await discardDraft(page);
    } finally {
      if (photoPath) {
        await admin.storage
          .from('field-audit-photos')
          .remove([photoPath])
          .catch(() => {
            /* orphaned object acceptable for v1 */
          });
      }
      await admin.from('field_audits').delete().eq('location_text', marker);
    }
  });

  test('escalates a FAIL to a corrective action — supervisor copy targets a test foreman, no role fan-out', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const admin = getSupabaseAdmin();

    const marker = `E2E-escalate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const failNote = `Single-hand grip near MAD (${marker})`;

    // Pin the audit's foreman to a TEST user so the escalation's supervisor
    // notification targets THAT user, never the general_foreman ROLE (which would
    // fan out to real people). An equipment subject sends no employee copy, so the
    // supervisor copy is the only notification — and it lands on a test account.
    const { data: foreman, error: foremanErr } = await admin
      .from('app_users')
      .select('id, user_id')
      .eq('email', 'test-foreman@atts.test')
      .single();
    expect(foremanErr, foremanErr?.message).toBeNull();
    const foremanAppUserId = foreman?.id as string;
    const foremanUserId = foreman?.user_id as string;
    expect(
      foremanAppUserId,
      'test foreman app_users row exists (run `npm run test:setup`)',
    ).toBeTruthy();

    const getAuditId = async (): Promise<string | null> => {
      const { data } = await admin
        .from('field_audits')
        .select('id')
        .eq('location_text', marker)
        .maybeSingle();
      return ((data?.id as string | undefined) ?? null) || null;
    };

    await admin.from('field_audits').delete().eq('location_text', marker);

    let itemId: string | null = null;
    let caId: string | null = null;
    try {
      await loginAs(page, 'safety_officer');
      await page.goto(FIELD_AUDIT_PATH);
      await dismissOnboardingIfPresent(page);

      await expect(page.getByTestId('field-audit-start-form')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('field-audit-location').fill(marker);
      await page.getByTestId('field-audit-start-btn').click();

      await expect(page.getByTestId('field-audit-resume')).toBeVisible({ timeout: 20_000 });
      await dismissOverlay(page);

      // Pin foreman_id BEFORE escalating. Service role bypasses the draft-only RLS;
      // the RPC reads foreman_id at escalation time to resolve the supervisor user.
      const auditId = await pollUntil(getAuditId);
      expect(auditId, 'audit row exists by marker').toBeTruthy();
      {
        const { error } = await admin
          .from('field_audits')
          .update({ foreman_id: foremanAppUserId })
          .eq('id', auditId as string);
        expect(error, error?.message).toBeNull();
      }

      const tray = page.getByTestId('field-audit-subjects-tray');
      await expect(tray).toBeVisible({ timeout: 20_000 });

      // Equipment subject (chainsaw) → equipment escalations send NO employee copy.
      await page.getByTestId('field-audit-equipment-type').selectOption('chainsaw');
      const unitInput = page.getByTestId('field-audit-equipment-number');
      await expect(unitInput).toBeVisible();
      await unitInput.fill('E2E-SAW-ESC');
      await page.getByTestId('field-audit-add-equipment-btn').click();

      // FAIL "Two-hand grip; secure footing" (no photo required) + required note.
      const failGroup = page.getByRole('radiogroup', { name: 'Two-hand grip' });
      await expect(failGroup).toBeVisible({ timeout: 20_000 });
      await failGroup.getByRole('radio', { name: 'Fail', exact: true }).click();
      const note = page.getByLabel('Finding note');
      await expect(note).toBeVisible();
      await note.fill(failNote);
      await note.press('Tab'); // blur → live upsert of the finding

      // Server truth: the fail row is saved (carries our marker note → has an id).
      const failRow = await pollUntil(async () => {
        const { data, error } = await admin
          .from('field_audit_items')
          .select('id, result, note')
          .eq('field_audit_id', auditId as string)
          .eq('result', 'fail')
          .maybeSingle();
        expect(error, error?.message).toBeNull();
        const row = data as { id: string; note: string | null } | null;
        return row?.note?.includes(marker) ? row : null;
      });
      itemId = failRow.id;

      // ── Runtime click: escalate at the corrective-action level (no points) ─────
      await page.getByTestId('field-audit-escalate-toggle').click();
      await expect(page.getByTestId('field-audit-escalation-form')).toBeVisible();
      await page.getByTestId('field-audit-escalate-submit').click();

      // UI: the control collapses to the issued ("Escalated") state.
      const issuedBadge = page.getByTestId('field-audit-escalation-issued');
      await expect(issuedBadge).toBeVisible({ timeout: 20_000 });
      await expect(issuedBadge).toContainText('Corrective action issued');

      // Server truth: the item now links a corrective action; that CA row exists.
      caId = await pollUntil(async () => {
        const { data, error } = await admin
          .from('field_audit_items')
          .select('corrective_action_id')
          .eq('id', itemId as string)
          .maybeSingle();
        expect(error, error?.message).toBeNull();
        return (data?.corrective_action_id as string | null) ?? null;
      });

      const { data: ca, error: caErr } = await admin
        .from('corrective_actions')
        .select('id, status, action_type, assigned_to')
        .eq('id', caId as string)
        .single();
      expect(caErr, caErr?.message).toBeNull();
      expect(ca?.status).toBe('open');
      expect(ca?.action_type).toBe('immediate');
      // Equipment findings default to the crew foreman (assignee precedence:
      // explicit override > audited person > crew foreman), so the CA lands on a
      // real owner's CAPA list instead of an unassigned row.
      expect(ca?.assigned_to, 'equipment fail is assigned to the crew foreman').toBe(
        foremanUserId,
      );

      // Notifications: the foreman is both assignee and supervisor, so exactly ONE
      // USER-targeted copy (no double-ping). No general_foreman ROLE fan-out →
      // zero real-person notifications.
      const events = await pollUntil(async () => {
        const { data, error } = await admin
          .from('notification_events')
          .select('target_type, target_ref, category')
          .eq('entity_type', 'field_audit_item')
          .eq('entity_id', itemId as string);
        expect(error, error?.message).toBeNull();
        const list = (data ?? []) as {
          target_type: string;
          target_ref: string | null;
          category: string;
        }[];
        return list.length > 0 ? list : null;
      });
      expect(events.every((e) => e.category === 'safety_alert')).toBe(true);
      expect(
        events.some((e) => e.target_type === 'role'),
        'no role-targeted (general_foreman) fan-out to real people',
      ).toBe(false);
      expect(
        events.some((e) => e.target_type === 'user' && e.target_ref === foremanUserId),
        'supervisor copy targets the test foreman as a user',
      ).toBe(true);
      // Equipment escalation, no deduction, foreman == assignee → a single event.
      expect(events, 'exactly one notification (assignee copy, deduped supervisor)').toHaveLength(1);
    } finally {
      // Zero residue: notifications (cascade outbox) → audit (cascade items) → CA.
      if (itemId) {
        await admin
          .from('notification_events')
          .delete()
          .eq('entity_type', 'field_audit_item')
          .eq('entity_id', itemId);
      }
      await admin.from('field_audits').delete().eq('location_text', marker);
      if (caId) {
        await admin.from('corrective_actions').delete().eq('id', caId);
      }
    }
  });

  test('review & submit: blockers gate the button, site checks count, server rollup locks the audit', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const admin = getSupabaseAdmin();

    const marker = `E2E-submit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const failNote = `TCP not followed — flagger off station (${marker})`;
    const closingNotes = `Crew receptive; re-briefed on TCP (${marker})`;

    interface AuditRow {
      id: string;
      status: string;
      submitted_at: string | null;
      notes: string | null;
    }

    const getAudit = async (): Promise<AuditRow | null> => {
      const { data, error } = await admin
        .from('field_audits')
        .select('id, status, submitted_at, notes')
        .eq('location_text', marker)
        .maybeSingle();
      expect(error, error?.message).toBeNull();
      return (data as AuditRow | null) ?? null;
    };

    await admin.from('field_audits').delete().eq('location_text', marker);

    let auditId: string | null = null;
    try {
      await loginAs(page, 'safety_officer');
      await page.goto(FIELD_AUDIT_PATH);
      await dismissOnboardingIfPresent(page);

      await expect(page.getByTestId('field-audit-start-form')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('field-audit-location').fill(marker);
      await page.getByTestId('field-audit-start-btn').click();
      await expect(page.getByTestId('field-audit-resume')).toBeVisible({ timeout: 20_000 });
      await dismissOverlay(page);

      auditId = (await pollUntil(getAudit)).id;
      const shortId = auditId.slice(0, 8);

      // ── Gate 1: an empty audit is a blocker ("no_checks") ────────────────────
      const review = page.getByTestId('field-audit-review');
      await expect(review).toBeVisible({ timeout: 20_000 });
      const verdict = review.getByTestId('field-audit-verdict');
      await expect(verdict).toHaveAttribute('data-grade', 'empty');
      const submitBtn = review.getByTestId('field-audit-submit-btn');
      await expect(submitBtn).toBeDisabled();

      // Sign-off alone must NOT unlock submit while blockers remain.
      await review.getByTestId('field-audit-signoff').check();
      await expect(submitBtn).toBeDisabled();
      await expect(review.getByTestId('field-audit-submit-reason')).toContainText('blockers');

      // ── Site conditions: audit-wide checks with subject = NULL ───────────────
      await page.getByTestId('field-audit-site-toggle').click();
      const siteCard = page.getByTestId('field-audit-site-card');
      const tcpGroup = siteCard.getByRole('radiogroup', { name: 'Traffic control plan' });
      await expect(tcpGroup).toBeVisible({ timeout: 20_000 });

      // ── Gate 2: a FAIL without a note is a blocker ("fail_note_missing") ─────
      await tcpGroup.getByRole('radio', { name: 'Fail', exact: true }).click();
      await expect(verdict).toHaveAttribute('data-grade', 'incomplete', { timeout: 20_000 });
      await expect(review.getByTestId('field-audit-readiness-list')).toContainText('note');
      await expect(submitBtn).toBeDisabled();

      // Note the finding → blocker clears. Pass a second site check.
      const note = siteCard.getByLabel('Finding note');
      await note.fill(failNote);
      await note.press('Tab');
      const dropGroup = siteCard.getByRole('radiogroup', { name: 'Drop zone established' });
      await dropGroup.getByRole('radio', { name: 'Pass', exact: true }).click();

      // Server truth: both rows are site-scoped (no subject) before we submit.
      await pollUntil(async () => {
        const { data, error } = await admin
          .from('field_audit_items')
          .select('result, note, field_audit_subject_id')
          .eq('field_audit_id', auditId as string);
        expect(error, error?.message).toBeNull();
        const rows = (data ?? []) as {
          result: string;
          note: string | null;
          field_audit_subject_id: string | null;
        }[];
        const fail = rows.find((r) => r.result === 'fail');
        const pass = rows.find((r) => r.result === 'pass');
        const ready =
          rows.length === 2 &&
          rows.every((r) => r.field_audit_subject_id === null) &&
          Boolean(fail?.note?.includes(marker)) &&
          Boolean(pass);
        return ready ? rows : null;
      });

      // Submit is now unlocked: an open (unescalated) fail + unanswered site checks
      // are warnings, not blockers.
      await expect(submitBtn).toBeEnabled({ timeout: 20_000 });
      await expect(review.getByTestId('field-audit-scorecard')).toContainText('2');

      // Closing notes autosave on blur and ride along with the submit.
      const closing = review.getByTestId('field-audit-closing-notes');
      await closing.fill(closingNotes);
      await closing.press('Tab');

      // ── Submit: warnings surface a confirm step, then the RPC runs ───────────
      await submitBtn.click();
      const confirm = page.getByTestId('field-audit-submit-confirm');
      await expect(confirm).toBeVisible();
      await confirm.getByTestId('field-audit-submit-confirm-confirm').click();

      // "Audit submitted" overlay → receipt from the server rollup.
      await dismissOverlay(page);
      const receipt = page.getByTestId('field-audit-receipt');
      await expect(receipt).toBeVisible({ timeout: 20_000 });
      await expect(receipt).toContainText(`#${shortId}`);
      await expect(receipt).toContainText('1 finding');
      await expect(receipt).toContainText('2 site checks');
      // No crew → no foreman → the receipt says so instead of implying an alert.
      await expect(receipt.getByTestId('field-audit-receipt-notify')).toContainText(
        'No crew foreman',
      );

      // Server truth: status flipped, timestamp stamped, notes persisted.
      const submitted = await pollUntil(async () => {
        const row = await getAudit();
        return row?.status === 'submitted' ? row : null;
      });
      expect(submitted.submitted_at).toBeTruthy();
      expect(submitted.notes).toBe(closingNotes);

      // The local draft pointer is released: a reload shows the Start form, not a
      // resumed (locked) audit.
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await dismissOnboardingIfPresent(page);
      await expect(page.getByTestId('field-audit-start-form')).toBeVisible({ timeout: 20_000 });

      // ── History deep link opens the locked detail; no admin-only reopen ──────
      await page.goto(`${FIELD_AUDIT_PATH}/history?audit=${auditId}`);
      await dismissOnboardingIfPresent(page);
      const detail = page.getByTestId('field-audit-detail-modal');
      await expect(detail).toBeVisible({ timeout: 20_000 });
      await expect(detail.getByTestId('field-audit-detail-subline')).toContainText('submitted');
      await expect(detail).toContainText('Site conditions');
      await expect(detail).toContainText(closingNotes);
      await expect(detail.getByTestId('field-audit-reopen-btn')).toHaveCount(0);
      await expect(detail.getByTestId('field-audit-resume-draft')).toHaveCount(0);
    } finally {
      if (auditId) {
        await admin
          .from('notification_events')
          .delete()
          .eq('entity_type', 'field_audit')
          .eq('entity_id', auditId);
      }
      await admin.from('field_audits').delete().eq('location_text', marker);
    }
  });

  test('standalone quick note writes field_notes (no audit) and the strip reflects it', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const admin = getSupabaseAdmin();

    // Equipment subject → fully deterministic (no roster dependency). The unit is
    // upper-trim normalized on write, so build it uppercase to match the stored value.
    const unit = `E2E-NOTE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const body = `Chain brake sticky — repair noted (${unit})`;
    const itemTag = 'chain brake';

    interface NoteRow {
      id: string;
      subject_type: string;
      equipment_type: string | null;
      equipment_number: string | null;
      note: string;
      note_kind: string;
      item_tag: string | null;
      field_audit_id: string | null;
      is_custom_equipment: boolean;
    }

    await admin.from('field_notes').delete().eq('equipment_number', unit);

    try {
      await loginAs(page, 'safety_officer');
      await page.goto(FIELD_AUDIT_PATH);
      await dismissOnboardingIfPresent(page);

      // No active audit → Start form renders, and the standalone notes card with it.
      await expect(page.getByTestId('field-audit-start-form')).toBeVisible({ timeout: 20_000 });

      // Open the standalone Field Notes section (no audit session needed).
      await page.getByTestId('field-audit-standalone-notes-toggle').click();
      const standalone = page.getByTestId('field-audit-standalone-notes');
      await expect(standalone).toBeVisible();

      // Resolve an equipment subject (chainsaw → free-text unit; required for notes).
      await standalone.getByTestId('field-audit-equipment-type').selectOption('chainsaw');
      const unitInput = standalone.getByTestId('field-audit-equipment-number');
      await expect(unitInput).toBeVisible();
      await unitInput.fill(unit);
      await standalone.getByTestId('field-audit-add-equipment-btn').click();

      // Composer appears for the resolved subject.
      const composer = page.getByTestId('field-audit-note-composer');
      await expect(composer).toBeVisible({ timeout: 20_000 });

      // note_kind chip + optional item_tag + body.
      await page.getByTestId('field-audit-note-kind-repair_noted').click();
      await page.getByTestId('field-audit-note-item-tag').fill(itemTag);
      await page.getByTestId('field-audit-note-body').fill(body);
      await page.getByTestId('field-audit-note-save').click();

      // "Note saved" renders the full-screen overlay toast — close it.
      await dismissOverlay(page);

      // Server truth: exactly the note we wrote, standalone (field_audit_id null).
      const noteRow = await pollUntil(async () => {
        const { data, error } = await admin
          .from('field_notes')
          .select(
            'id, subject_type, equipment_type, equipment_number, note, note_kind, item_tag, field_audit_id, is_custom_equipment',
          )
          .eq('equipment_number', unit)
          .maybeSingle();
        expect(error, error?.message).toBeNull();
        return (data as NoteRow | null) ?? null;
      });
      expect(noteRow.subject_type).toBe('equipment');
      expect(noteRow.equipment_type).toBe('chainsaw');
      expect(noteRow.note).toBe(body);
      expect(noteRow.note_kind).toBe('repair_noted');
      expect(noteRow.item_tag).toBe(itemTag);
      expect(noteRow.field_audit_id, 'standalone note is not tied to an audit').toBeNull();
      expect(noteRow.is_custom_equipment).toBe(false);

      // UI truth: the RecentNotesStrip under the composer now shows the note.
      await expect(standalone).toContainText(body, { timeout: 20_000 });
    } finally {
      await admin.from('field_notes').delete().eq('equipment_number', unit);
    }
  });
});
