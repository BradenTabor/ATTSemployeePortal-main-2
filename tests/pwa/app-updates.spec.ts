import { test, expect, type Page } from '@playwright/test';

async function checkUpdate(page: Page) {
  await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
}
test.beforeEach(async ({ request, context, page }) => {
  await request.get('/__release?version=A');
  // These tests exercise the built app and real workers without contacting production APIs.
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.reload();
  await expect(page).toHaveTitle('ATTS Release A');
  await page.evaluate(async () => {
    localStorage.setItem('update-saved-draft', 'keep me');
    const cache = await caches.open('update-saved-photo');
    await cache.put('/saved-photo', new Response('photo bytes'));
  });
});

test('installs a release before prompting, reloads once, and preserves offline data', async ({ page, request, context, browserName }, info) => {
  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  await request.get('/__release?version=B');
  await checkUpdate(page);
  await expect(page.getByRole('button', { name: 'Update app now' })).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3500); // Regression: the removed checker reloaded after three seconds.
  expect(navigations).toBe(0);
  await page.screenshot({ path: info.outputPath('update-ready.png') });
  await page.getByRole('button', { name: 'Update app now' }).click();
  await expect(page).toHaveTitle('ATTS Release B');
  await page.waitForTimeout(1000);
  expect(navigations).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('update-saved-draft'))).toBe('keep me');
  expect(await page.evaluate(async () => (await (await caches.open('update-saved-photo')).match('/saved-photo'))?.text())).toBe('photo bytes');
  // WebKit's protocol-offline navigation throws an internal browser error.
  // Deny every origin request instead; the installed worker must supply the shell.
  await request.get('/__release?version=B&offline=1');
  if (browserName === 'chromium') await context.setOffline(true);
  await page.goto('/offline-deep-link');
  await expect(page).toHaveTitle('ATTS Release B');
});

test('failed release download leaves the current app usable and retries cleanly', async ({ page, request }) => {
  await request.get('/__release?version=B&fail=1');
  await checkUpdate(page);
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).installing))).toBe(false);
  await expect(page).toHaveTitle('ATTS Release A');
  await expect(page.getByRole('button', { name: 'Update app now' })).toBeHidden();
  await request.get('/__release?version=B');
  await checkUpdate(page);
  await expect(page.getByRole('button', { name: 'Update app now' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Update app now' }).click();
  await expect(page).toHaveTitle('ATTS Release B');
});
