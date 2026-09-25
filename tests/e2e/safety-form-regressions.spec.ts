import { readFileSync } from 'node:fs';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getSupabaseAdmin } from './helpers/supabaseAdmin';
import { goOffline, goOnline, getQueueLength } from './helpers/offline';

test.setTimeout(90_000);
test.use({ actionTimeout: 15000 });
const db = getSupabaseAdmin();
const tag = () => `E2E-SAFETY-${crypto.randomUUID()}`;
// In-memory camera-style files avoid WebKit's OS file handles becoming unreadable
// when its network emulator goes offline. The image bytes still travel through real IDB and Storage.
const photo = { name: 'hydraulic.jpg', mimeType: 'image/jpeg', buffer: readFileSync('tests/fixtures/hydraulic.jpg') };

test.beforeEach(async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('close', () => { void testInfo.attach('browser-errors', { body: errors.join('\n'), contentType: 'text/plain' }); });
  await page.addInitScript(() => {
    localStorage.setItem('atts_onboarding_completed_version', '999.0.0');
    localStorage.setItem('atts_ios_install_prompt_dismissed', 'true');
  });
  await page.route('https://hook.us2.make.com/**', route => route.abort());
  await loginAs(page, 'employee');

});

async function equipment(page: Page, name: string, specific = true) {
  await page.goto('/dashboard/forms/equipment-inspection');
  await page.getByTestId('equipment-type-select').selectOption('Geo-Boy');
  await page.locator('[name=equipmentNumber]').selectOption('G-126');
  await page.locator('#submittedBy').fill(name);
  await page.locator('section').filter({ hasText: 'Step 2 · General' }).getByRole('button', { name: 'All Pass', exact: true }).click();
  if (specific) await page.locator('section').filter({ hasText: 'Step 3 · Specific' }).getByRole('button', { name: 'All Pass', exact: true }).click();
  await page.locator('[name=hydraulic-photo]').setInputFiles(photo);
  await expect(page.getByRole('img', { name: 'Hydraulic Fluid Level preview' })).toBeVisible();
}

async function dvir(page: Page, name: string, truck = 'B132') {
  await page.goto('/dashboard/forms/dvir');
  await page.locator('[name=truckNumber]').selectOption(truck);
  await page.locator('#driversName').fill(name);
  await page.locator('#mileage').fill('999999');
  await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Section B. Vehicle / Trailer Inspection Checklist', exact: true }) })
    .getByRole('button', { name: 'All Pass', exact: true }).click();
  await page.locator('input[aria-label="Upload oil dipstick photo"]').setInputFiles(photo);
  await page.locator('#finalDriverSignature').fill(name);
}

async function jsa(page: Page, name: string, paper = false) {
  await page.goto('/forms/jsa');
  if (paper) {
    await page.getByRole('button', { name: 'Switch to upload a photo of a paper JSA form instead' }).click();
    await page.getByPlaceholder('Street, city, project').fill(name);
    await page.getByPlaceholder('Type your full name').fill('E2E Worker');
    return;
  }
  await page.getByLabel(/Work Location/i).fill(name);
  for (const label of [/OC Contact/i, /DOC Tel/i, /GF Contact/i, /Safety Tel/i]) await page.getByLabel(label).fill('870-555-1234');
  await page.getByTestId('jsa-step-2').click();
  await page.getByRole('button', { name: 'Jarraff Trimmer', exact: true }).click();
  await page.getByTestId('jsa-step-5').click();
  await page.getByPlaceholder('e.g., Pole 42, Main St & 5th').first().fill('Pole 1');
  await page.getByTestId('jsa-step-6').click();
  await page.getByTestId('employee-signature').fill('E2E Worker');
}

async function reconnectAndCheck(page: Page, context: BrowserContext, table: string, field: string, value: string) {
  await expect.poll(async () => await getQueueLength(page)).toBe(1);
  await goOnline(page, context);
  await expect.poll(async () => {
    const { data, error } = await db.from(table).select('id').eq(field, value);
    if (error) throw error;
    return data?.length;
  }, { timeout: 30000 }).toBe(1);
  await expect.poll(async () => await getQueueLength(page), { timeout: 15000 }).toBe(0);
}

async function confirmPhoto(table: string, field: string, value: string, column: string, bucket: string) {
  const { data, error } = await db.from(table).select(`id,${column}`).eq(field, value).single();
  expect(error).toBeNull();
  const path = (data as unknown as Record<string, unknown>)[column];
  const paths = Array.isArray(path) ? path : [path];
  expect(paths.length).toBeGreaterThan(0);
  for (const file of paths) {
    expect(file).toEqual(expect.any(String));
    expect(file).not.toMatch(/^(offline|local-jsa-photo):/);
    const download = await db.storage.from(bucket).download(String(file));
    expect(download.error).toBeNull();
    expect(download.data?.size).toBeGreaterThan(0);
  }
}

test('equipment rejects missing specific checks and undocumented defects', async ({ page }) => {
  let inserts = 0;
  page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/rest/v1/daily_equipment_inspections')) inserts++; });
  await equipment(page, tag(), false);
  await expect(page.getByTestId('submit-button')).toBeDisabled();
  await page.locator('section').filter({ hasText: 'Step 3 · Specific' }).getByRole('button', { name: 'All Pass', exact: true }).click();
  await page.getByRole('button', { name: 'Mark Engine oil level as Fail', exact: true }).click();
  await expect(page.getByTestId('submit-button')).toBeDisabled();
  expect(inserts).toBe(0);
});

test('JSA Save recovers after validation and can save a draft', async ({ page }) => {
  const name = tag();
  await page.goto('/forms/jsa');
  await page.getByTestId('jsa-step-5').click();
  await page.getByPlaceholder('e.g., Pole 42, Main St & 5th').first().fill('Pole 1');
  await page.getByTestId('jsa-step-6').click();
  await page.getByTestId('jsa-complete').click();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(page.getByTestId('save-button')).toBeEnabled();
  await page.getByLabel(/Work Location/i).fill(name);
  await page.getByTestId('save-button').click();
  const saved = page.waitForResponse(r => r.url().includes('/rest/v1/daily_jsa') && r.request().method() === 'POST');
  await page.getByTestId('save-draft').click();
  expect((await saved).status()).toBe(201);
  const { data } = await db.from('daily_jsa').select('status').eq('work_location', name).single();
  expect(data?.status).toBe('draft');
});

for (const kind of ['dvir', 'equipment'] as const) {
  test(`${kind} restores selected photos after a reload and saves the actual record`, async ({ page }, testInfo) => {
    const name = tag();
    if (kind === 'dvir') await dvir(page, name); else await equipment(page, name);
    await page.waitForTimeout(600); // draft persistence debounce
    page.on('dialog', d => d.accept());
    await page.reload();
    if (kind === 'equipment') await expect(page.getByRole('img', { name: 'Hydraulic Fluid Level preview' })).toBeVisible();
    else await expect(page.locator('#driversName')).toHaveValue(name);
    const notice = page.getByRole('button', { name: 'Dismiss notification' });
    if (await notice.isVisible()) {
      await notice.click();
      await expect(notice).toBeHidden();
    }
    await page.screenshot({ path: testInfo.outputPath('restored-form.png'), fullPage: true });
    const table = kind === 'dvir' ? 'dvir_reports' : 'daily_equipment_inspections';
    const saved = page.waitForResponse(r => r.url().includes(`/rest/v1/${table}`) && r.request().method() === 'POST');
    await page.getByTestId(kind === 'dvir' ? 'dvir-submit-button' : 'submit-button').click();
    expect((await saved).status()).toBe(201);
    await confirmPhoto(table, kind === 'dvir' ? 'drivers_name' : 'submitted_by', name,
      kind === 'dvir' ? 'oil_dipstick_path' : 'hydraulic_photo_path', kind === 'dvir' ? 'dvir-photos' : 'equipment-inspection-photos');
  });
}

test('paper JSA captures photos offline and syncs', async ({ page, context }) => {
  const name = tag();
  await jsa(page, name, true);
  await goOffline(page, context);
  await page.getByLabel('Add photos for JSA (take photo or choose file)').setInputFiles(photo);
  await expect(page.getByRole('img', { name: 'Paper JSA page' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.getByTestId('paper-jsa-save').click();
  await reconnectAndCheck(page, context, 'daily_jsa', 'work_location', name);
  await confirmPhoto('daily_jsa', 'work_location', name, 'jsa_photo_paths', 'jsa-photos');
});

test('an existing JSA edit queues offline and updates exactly the same row', async ({ page, context }) => {
  const name = tag();
  await jsa(page, name);
  const saved = page.waitForResponse(r => r.url().includes('/rest/v1/daily_jsa') && r.request().method() === 'POST');
  await page.getByTestId('jsa-complete').click();
  expect((await saved).status()).toBe(201);
  const { data } = await db.from('daily_jsa').select('id').eq('work_location', name).single();
  await page.goto(`/forms/jsa/${data!.id}`);
  await page.getByTestId('jsa-step-1').click();
  await expect(page.getByLabel(/Work Location/i)).toHaveValue(name);
  await goOffline(page, context);
  await page.getByLabel(/Work Location/i).fill(name + '-edited');
  await page.getByTestId('save-button').click();
  await page.getByTestId('save-draft').click();
  await reconnectAndCheck(page, context, 'daily_jsa', 'work_location', name + '-edited');
  const updated = await db.from('daily_jsa').select('id,status').eq('work_location', name + '-edited').single();
  expect(updated.data).toEqual({ id: data!.id, status: 'draft' });
});

for (const kind of ['dvir', 'equipment'] as const) {
  test(`${kind} syncs an offline submission with its real photo exactly once`, async ({ page, context }) => {
    const name = tag();
    if (kind === 'dvir') {
      const existing = await db.from('dvir_reports').select('truck_number');
      expect(existing.error).toBeNull();
      const used = new Set(existing.data?.map(row => row.truck_number));
      const truck = ['B103', 'B114', 'B122', 'B124', 'B137', 'B151', '158', '149', '147', '104', '155', '156', '139', '141', '125', '142', '143'].find(value => !used.has(value));
      expect(truck).toBeTruthy();
      await dvir(page, name, truck!);
    } else {
      await equipment(page, name);
      const date = new Date(Date.UTC(2000, 0, 1) + Math.floor(Math.random() * 7000) * 86400000).toISOString().slice(0, 10);
      await page.locator('input[type=date]').fill(date);
    }
    await goOffline(page, context);
    await page.getByTestId(kind === 'dvir' ? 'dvir-submit-button' : 'submit-button').click();
    const table = kind === 'dvir' ? 'dvir_reports' : 'daily_equipment_inspections';
    const field = kind === 'dvir' ? 'drivers_name' : 'submitted_by';
    await reconnectAndCheck(page, context, table, field, name);
    await confirmPhoto(table, field, name, kind === 'dvir' ? 'oil_dipstick_path' : 'hydraulic_photo_path',
      kind === 'dvir' ? 'dvir-photos' : 'equipment-inspection-photos');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(2500);
    const rows = await db.from(table).select('id').eq(field, name);
    expect(rows.data).toHaveLength(1);
  });
}
