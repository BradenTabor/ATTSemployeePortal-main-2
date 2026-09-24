import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getSupabaseAdmin } from './helpers/supabaseAdmin';

const db = getSupabaseAdmin();
const bytes = readFileSync('tests/fixtures/hydraulic.jpg');
test.use({ reducedMotion: 'reduce' });
test.setTimeout(60000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atts_onboarding_completed_version', '999.0.0');
    localStorage.setItem('atts_ios_install_prompt_dismissed', 'true');
    localStorage.setItem('push_notification_prompt_dismissed', 'true');
  });
  await loginAs(page, 'admin');
});

async function fixture(bucket: string) {
  const id = crypto.randomUUID();
  const { data: user, error } = await db.from('app_users').select('user_id').eq('email', 'test-admin@atts.test').single();
  if (error) throw error;
  const path = `${user.user_id}/review-${id}.jpg`;
  const upload = await db.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg' });
  if (upload.error) throw upload.error;
  return { id, path, user_id: user.user_id, name: `E2E-REVIEW-${id}` };
}

async function imageLoads(page: Page, name: string) {
  const img = page.getByRole('img', { name, exact: true });
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
}

test('admin can open saved paper JSA photos at full size', async ({ page }, testInfo) => {
  const f = await fixture('jsa-photos');
  try {
    const insert = await db.from('daily_jsa').insert({ id: f.id, user_id: f.user_id, work_location: f.name,
      job_date: '2026-09-24', status: 'completed', submission_type: 'paper', employee_signature: 'Review Signer', jsa_photo_paths: [f.path] });
    if (insert.error) throw insert.error;
    await page.goto('/admin/jsa');
    await page.getByPlaceholder('Location, circuit, notes...').fill(f.name);
    await page.getByText(f.name, { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole('dialog', { name: 'JSA details' })).toContainText(f.name);
    await expect(page.getByRole('dialog', { name: 'JSA details' })).toContainText('Sep 24, 2026');
    await expect(page.getByText('Review Signer', { exact: false }).first()).toBeVisible();
    await imageLoads(page, 'Paper JSA page');
    await page.getByRole('img', { name: 'Paper JSA page', exact: true }).click();
    await imageLoads(page, 'Paper JSA page (full size)');
    await page.screenshot({ path: testInfo.outputPath('paper-jsa-fullsize.png') });
    await page.getByRole('button', { name: 'Close photo', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Paper JSA page (full size)' })).toBeHidden();
    await page.getByRole('button', { name: 'Close detail panel' }).click();
    const update = await db.from('daily_jsa').update({ submission_type: 'digital', ppe: {
      hard_hats: { required: true, condition: 'Good' },
    } }).eq('id', f.id);
    if (update.error) throw update.error;
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'JSA details' })).toBeHidden();
    await page.getByText(f.name, { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText('Required · Good', { exact: true })).toBeVisible();
  } finally {
    await db.from('daily_jsa').delete().eq('id', f.id);
    await db.storage.from('jsa-photos').remove([f.path]);
  }
});

test('equipment review shows extra photos, defects, and lockout details', async ({ page }, testInfo) => {
  const f = await fixture('equipment-inspection-photos');
  try {
    const insert = await db.from('daily_equipment_inspections').insert({ id: f.id, user_id: f.user_id,
      submitted_by: f.name, equipment_type: 'Geo-Boy', equipment_number: 'G-126', inspection_date: '2026-09-24', template: 'geo_boy',
      general_checklist: { engine_oil_level: 'F' }, specific_checklist: {}, notes: 'Oil leak requires repair',
      hydraulic_photo_path: f.path, additional_photo_paths: [f.path], loto_required: true,
      loto_data: { procedure_followed: true, lockout_device_applied: true, tagout_attached: true, zero_energy_verified: true,
        authorized_employee: 'Review Lockout Operator', lockout_datetime: '2026-09-24T08:30' } });
    if (insert.error) throw insert.error;
    await page.goto('/mechanic-equipment-center');
    await page.getByPlaceholder('Search equipment or operator...').fill(f.name);
    await page.getByText(f.name, { exact: true }).first().click();
    await expect(page.getByText('Oil leak requires repair', { exact: true }).last()).toBeVisible();
    const loto = page.getByRole('group', { name: 'LOTO (Lockout/Tagout) section' });
    await expect(loto.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Review Lockout Operator');
    for (const checkbox of await loto.getByRole('checkbox').all()) {
      await expect(checkbox).toBeChecked();
      await expect(checkbox).toBeDisabled();
    }
    await page.getByText('Photos (2)', { exact: true }).click();
    await imageLoads(page, 'Hydraulic Fluid Level');
    await imageLoads(page, 'Additional Photo 1');
    await page.getByRole('img', { name: 'Additional Photo 1' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('equipment-evidence.png') });
  } finally {
    await db.from('daily_equipment_inspections').delete().eq('id', f.id);
    await db.storage.from('equipment-inspection-photos').remove([f.path]);
  }
});

test('DVIR admin review shows saved photo, driver signature, and defect notes', async ({ page }, testInfo) => {
  const f = await fixture('dvir-photos');
  try {
    const insert = await db.from('dvir_reports').insert({ id: f.id, user_id: f.user_id, truck_number: 'B132', mileage: 123456,
      drivers_name: f.name, final_driver_signature: 'Review Driver Signature', oil_dipstick_path: f.path,
      vehicle_trailer_checklist: { service_brakes: 'F' }, notes: 'Brake defect requires repair', report_date: '2026-09-24' });
    if (insert.error) throw insert.error;
    await page.goto('/mechanic-dvir-center');
    await page.getByPlaceholder('Search truck or driver...').fill(f.name);
    await page.getByText(f.name, { exact: true }).first().click();
    await expect(page.getByText('Brake defect requires repair', { exact: true }).last()).toBeVisible();
    await page.getByText('Photos (1)', { exact: true }).click();
    await imageLoads(page, 'Oil Dipstick');
    await page.getByText('Signatures (1)', { exact: true }).click();
    await expect(page.getByText('Review Driver Signature', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('dvir-evidence.png') });
  } finally {
    await db.from('dvir_reports').delete().eq('id', f.id);
    await db.storage.from('dvir-photos').remove([f.path]);
  }
});
