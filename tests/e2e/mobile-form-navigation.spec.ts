import { test, expect, type Locator } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atts_onboarding_completed_version', '999.0.0');
    localStorage.setItem('atts_ios_install_prompt_dismissed', 'true');
  });
  await loginAs(page, 'employee');
});
async function accessible(button: Locator) {
  await expect(button).toBeInViewport({ ratio: 1 });
  expect(await button.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit === el || el.contains(hit);
  })).toBe(true);
}

test('JSA navigation fits short iPhone viewports and stays available through every step', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await page.goto('/forms/jsa');
  await expect(page.getByTestId('jsa-wizard')).toBeVisible();
  await page.screenshot({ path: info.outputPath('jsa-initial.png') });
  for (let step = 1; step <= 6; step++) {
    await accessible(page.getByTestId('save-button'));
    await accessible(page.getByTestId(step === 6 ? 'jsa-complete' : 'jsa-next'));
    if (step < 6) await page.getByTestId('jsa-next').click();
  }
  await page.setViewportSize({ width: 390, height: 420 });
  await accessible(page.getByTestId('save-button'));
  await accessible(page.getByTestId('jsa-complete'));
  await page.getByTestId('save-button').click();
  await accessible(page.getByTestId('save-draft'));
  await page.getByTestId('save-button').click();
  await page.screenshot({ path: info.outputPath('jsa-short.png') });
});

for (const [name, route] of [
  ['DVIR', '/dashboard/forms/dvir'],
  ['equipment', '/dashboard/forms/equipment-inspection'],
  ['RTO', '/dashboard/forms/request-time-off'],
  ['tree-felling', '/forms/jsa/tree-felling'],
] as const) {
  test(`${name} submit remains visible above return navigation`, async ({ page }, info) => {
    await page.setViewportSize({ width: 375, height: 600 });
    await page.goto(route);
    const submit = name === 'tree-felling'
      ? page.getByRole('button', { name: 'Submit Tree Felling JSA' })
      : page.getByTestId(name === 'DVIR' ? 'dvir-submit-button' : name === 'RTO' ? 'rto-submit-button' : 'submit-button');
    await submit.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${name}-submit.png`) });
    await accessible(submit);
    const dock = await page.getByTestId('return-dock').boundingBox();
    const button = await submit.boundingBox();
    expect(button!.y + button!.height).toBeLessThanOrEqual(dock!.y);
  });
}

test('paper JSA save stays inside the visible viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await page.goto('/forms/jsa');
  await page.getByRole('button', { name: 'Switch to upload a photo of a paper JSA form instead' }).click();
  await accessible(page.getByTestId('paper-jsa-save'));
  await page.setViewportSize({ width: 667, height: 375 });
  await accessible(page.getByTestId('paper-jsa-save'));
  await page.screenshot({ path: info.outputPath('paper-jsa-landscape.png') });
});
