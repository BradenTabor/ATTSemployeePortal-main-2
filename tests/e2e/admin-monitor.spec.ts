import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { loginAs } from './helpers/auth';
import { getSupabaseAdmin } from './helpers/supabaseAdmin';

const password = 'local-test-monitor-password';
const db = getSupabaseAdmin();
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('atts_onboarding_completed_version', '999.0.0'));
});

test.beforeAll(async () => {
  const { error } = await db.from('admin_external_tools').upsert({ id: 'po-monitor', password });
  if (error) throw error;
});

test('admin monitor card shows credentials and copies the full password', async ({ page, context, browserName }, testInfo) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  else await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => {
      (window as unknown as { copiedPassword: string }).copiedPassword = value;
    } } });
  });
  await loginAs(page, 'admin');
  const card = page.getByRole('region', { name: 'PO# analytics & system monitor' });
  await expect(card.getByLabel('Monitor login password')).toHaveValue(password);
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'Copy password' }).click();
  await expect(card.getByRole('button', { name: 'Copied!' })).toBeVisible();
  const copied = await page.evaluate(async () => 'copiedPassword' in window
    ? (window as unknown as { copiedPassword: string }).copiedPassword : navigator.clipboard.readText());
  expect(copied).toBe(password);
  const link = card.getByRole('link', { name: /Open PO monitor/ });
  await expect(link).toHaveAttribute('href', 'https://atts-po-monitor.vercel.app/');
  await expect(link).toHaveAttribute('target', '_blank');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('admin-monitor.png') });

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async () => { throw new Error('Permission denied'); },
  } }));
  await expect(card.getByRole('button', { name: 'Copy password' })).toBeVisible({ timeout: 5000 });
  await card.getByRole('button', { name: 'Copy password' }).click();
  await expect(card.getByRole('status')).toContainText('password is selected');
  expect(await card.getByLabel('Monitor login password').evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!)).toBe(password.length);
});

test('password load failure offers retry and recovers', async ({ page, context }) => {
  await context.route('**/rest/v1/rpc/get_po_monitor_password', route => route.fulfill({ status: 403, body: '{}' }));
  await loginAs(page, 'admin');
  await expect(page.getByRole('button', { name: 'Retry password' })).toBeVisible();
  await context.unroute('**/rest/v1/rpc/get_po_monitor_password');
  await page.getByRole('button', { name: 'Retry password' }).click();
  await expect(page.getByLabel('Monitor login password')).toHaveValue(password);
});

test('database permits admins only and prevents browser credential changes', async () => {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_ANON_KEY!;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymous = await client.from('admin_external_tools').select('*');
  expect(anonymous.error).toBeTruthy();
  for (const role of ['employee', 'foreman', 'mechanic', 'gf', 'safety', 'admin']) {
    const { error } = await client.auth.signInWithPassword({ email: `test-${role}@atts.test`, password: 'TestPassword123!' });
    expect(error).toBeNull();
    const result = await client.from('admin_external_tools').select('password').eq('id', 'po-monitor');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(role === 'admin' ? [{ password }] : []);
    const rpc = await client.rpc('get_po_monitor_password');
    expect(rpc.error).toBeNull();
    expect(rpc.data).toBe(role === 'admin' ? password : null);
    const write = await client.from('admin_external_tools').update({ password: 'unauthorized' }).eq('id', 'po-monitor');
    expect(write.error).toBeTruthy();
    await client.auth.signOut({ scope: 'local' });
  }
});
