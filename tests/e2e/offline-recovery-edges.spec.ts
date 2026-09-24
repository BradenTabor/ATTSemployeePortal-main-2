import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getSupabaseAdmin } from './helpers/supabaseAdmin';

const db = getSupabaseAdmin();
const bytes = Array.from(readFileSync('tests/fixtures/hydraulic.jpg'));
const tables = { jsa: 'daily_jsa', dvir: 'dvir_reports', equipment: 'daily_equipment_inspections' };
const buckets = { jsa: 'jsa-photos', dvir: 'dvir-photos', equipment: 'equipment-inspection-photos' };
type Kind = keyof typeof tables;
test.setTimeout(90000);
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atts_onboarding_completed_version', '999.0.0');
    localStorage.setItem('atts_ios_install_prompt_dismissed', 'true');
  });
  await loginAs(page, 'employee');
});

async function seedQueue(page: Page, kind: Kind, status = 'pending') {
  return page.evaluate(async ({ kind, bytes, status }) => {
    const { supabase } = await import(`${location.origin}/src/lib/supabaseClient.ts`);
    const queue = await import(`${location.origin}/src/lib/offlineQueue.ts`);
    const photos = await import(`${location.origin}/src/lib/offlinePhotoStore.ts`);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session.user.id;
    const recordId = crypto.randomUUID();
    const photoQueueId = `edge-photos-${recordId}`;
    const name = `E2E-EDGE-${recordId}`;
    const fieldName = kind === 'jsa' ? 'jsa_page_1' : kind === 'dvir' ? 'oil_dipstick' : 'hydraulic';
    const photoIds = await photos.storePhotosForQueue(photoQueueId, kind, [{
      fieldName, blob: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), fileName: 'photo.jpg', contentType: 'image/jpeg', compressed: true,
    }]);
    const fields = kind === 'jsa'
      ? { work_location: name, job_date: '2026-09-24', status: 'completed', submission_type: 'paper', employee_signature: 'Offline Recovery', jsa_photo_paths: [] }
      : kind === 'dvir'
        ? { truck_number: name, drivers_name: 'Offline Recovery', mileage: 123, report_date: '2026-09-24', oil_dipstick_path: 'offline:photo' }
        : { equipment_number: name, equipment_type: 'Geo-Boy', inspection_date: '2026-09-24', hydraulic_photo_path: 'offline:photo', submitted_by: 'Offline Recovery' };
    const queueId = await queue.addToQueue(kind, { ...fields, id: recordId, user_id: userId, __offlineQueueId: photoQueueId }, {
      userId, dateFor: '2026-09-24', photoIds,
    });
    if (status !== 'pending') {
      const request = indexedDB.open('atts-offline-queue', 2);
      const database: IDBDatabase = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const tx = database.transaction('submissions', 'readwrite');
      const store = tx.objectStore('submissions');
      const get = store.get(queueId);
      get.onsuccess = () => store.put({ ...get.result, status });
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      database.close();
    }
    return { recordId, queueId, photoQueueId, userId };
  }, { kind, bytes, status });
}

async function queueState(page: Page, queueId: string) {
  return page.evaluate(async id => {
    const queue = await import(`${location.origin}/src/lib/offlineQueue.ts`);
    const item = await queue.getQueueItem(id);
    return item ? { status: item.status, retryCount: item.retryCount } : null;
  }, queueId);
}

async function verifyAndClean(page: Page, kind: Kind, saved: Awaited<ReturnType<typeof seedQueue>>) {
  let row: Record<string, unknown> | undefined;
  await expect.poll(async () => {
    const { data, error } = await db.from(tables[kind]).select('*').eq('id', saved.recordId);
    if (error) throw error;
    row = data?.[0];
    return data?.length;
  }, { timeout: 30000 }).toBe(1);
  expect(row?.user_id).toBe(saved.userId);
  const path = kind === 'jsa' ? (row?.jsa_photo_paths as string[])[0] : kind === 'dvir' ? row?.oil_dipstick_path : row?.hydraulic_photo_path;
  const download = await db.storage.from(buckets[kind]).download(String(path));
  expect(download.error).toBeNull();
  expect(download.data?.size).toBe(bytes.length);
  expect(Array.from(new Uint8Array(await download.data!.arrayBuffer()))).toEqual(bytes);
  await expect.poll(() => queueState(page, saved.queueId)).toBeNull();
  await page.reload();
  expect((await db.from(tables[kind]).select('id').eq('id', saved.recordId)).data).toHaveLength(1);
  await db.from(tables[kind]).delete().eq('id', saved.recordId);
  await db.storage.from(buckets[kind]).remove([String(path)]);
}

for (const kind of ['jsa', 'dvir', 'equipment'] as const) {
  test(`${kind} resumes an interrupted syncing entry after app restart`, async ({ page }) => {
    const saved = await seedQueue(page, kind, 'syncing');
    await page.reload();
    await verifyAndClean(page, kind, saved);
  });
}

test('interrupted photo upload retains its bytes and retries the same storage path', async ({ page, context }, testInfo) => {
  const uploadPaths: string[] = [];
  await context.route('**/storage/v1/object/equipment-inspection-photos/**', route => {
    uploadPaths.push(new URL(route.request().url()).pathname);
    return route.abort('connectionreset');
  });
  const saved = await seedQueue(page, 'equipment');
  await page.reload();
  await expect.poll(() => queueState(page, saved.queueId), { timeout: 30000 }).toMatchObject({ status: 'failed', retryCount: 1 });
  expect((await db.from('daily_equipment_inspections').select('id').eq('id', saved.recordId)).data).toHaveLength(0);
  await context.unroute('**/storage/v1/object/equipment-inspection-photos/**');
  page.on('request', req => { if (req.url().includes('/storage/v1/object/equipment-inspection-photos/')) uploadPaths.push(new URL(req.url()).pathname); });
  await page.getByRole('button', { name: 'View queue details' }).click();
  await expect(page.getByTitle('Retry', { exact: true })).toBeVisible();
  await page.getByTitle('Retry', { exact: true }).click({ trial: true });
  // WebKit can report actionability before the drawer's compositor frame paints.
  await page.waitForTimeout(700);
  await page.screenshot({ path: testInfo.outputPath('failed-upload-retry.png') });
  await page.getByTitle('Retry', { exact: true }).click();
  await verifyAndClean(page, 'equipment', saved);
  expect(uploadPaths.length).toBeGreaterThanOrEqual(2);
  expect(new Set(uploadPaths).size).toBe(1);
});

test('switching accounts keeps the original queue private and recoverable', async ({ page }) => {
  const saved = await seedQueue(page, 'jsa', 'failed_manual');
  await page.evaluate(async () => {
    const { supabase } = await import(`${location.origin}/src/lib/supabaseClient.ts`);
    await supabase.auth.signOut({ scope: 'local' });
    const result = await supabase.auth.signInWithPassword({ email: 'test-admin@atts.test', password: 'TestPassword123!' });
    if (result.error) throw result.error;
  });
  await page.goto('/admin');
  const visibleCount = await page.evaluate(async () => {
    const { supabase } = await import(`${location.origin}/src/lib/supabaseClient.ts`);
    const queue = await import(`${location.origin}/src/lib/offlineQueue.ts`);
    const { data: { session } } = await supabase.auth.getSession();
    return (await queue.getPendingItems(session.user.id)).length;
  });
  expect(visibleCount).toBe(0);
  expect(await queueState(page, saved.queueId)).toMatchObject({ status: 'failed_manual' });
  await page.evaluate(async id => {
    const { supabase } = await import(`${location.origin}/src/lib/supabaseClient.ts`);
    await supabase.auth.signOut({ scope: 'local' });
    const result = await supabase.auth.signInWithPassword({ email: 'test-employee@atts.test', password: 'TestPassword123!' });
    if (result.error) throw result.error;
    const queue = await import(`${location.origin}/src/lib/offlineQueue.ts`);
    await queue.retryManual(id);
  }, saved.queueId);
  await page.goto('/dashboard');
  await verifyAndClean(page, 'jsa', saved);
});

test('expired session with rejected refresh preserves the form until sign-in', async ({ page, context }) => {
  const saved = await seedQueue(page, 'jsa', 'failed_manual');
  await context.route('**/auth/v1/token?grant_type=refresh_token', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }) }));
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'))!;
    const session = JSON.parse(localStorage.getItem(key)!);
    session.expires_at = 1;
    localStorage.setItem(key, JSON.stringify(session));
  });
  await page.reload();
  await expect(page.locator('#auth-email')).toBeVisible({ timeout: 30000 });
  expect(await queueState(page, saved.queueId)).toMatchObject({ retryCount: 0 });
  await context.unroute('**/auth/v1/token?grant_type=refresh_token');
  await loginAs(page, 'employee');
  await page.evaluate(async id => {
    const queue = await import(`${location.origin}/src/lib/offlineQueue.ts`);
    await queue.retryManual(id);
  }, saved.queueId);
  await page.reload();
  await verifyAndClean(page, 'jsa', saved);
});
