import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Automated accessibility checks (axe) over the rendered proof path. We gate on
// serious/critical WCAG 2 A/AA violations.
test('no serious accessibility violations on the main proof view', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.locator('.status-calm')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.ledger-panel')).toBeVisible({ timeout: 20_000 });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    // The embedded PDF <object> renders a cross-origin-ish viewer we don't own.
    .exclude('.pdf-object')
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  if (serious.length) {
    testInfo.attach('axe-violations', {
      body: JSON.stringify(serious, null, 2),
      contentType: 'application/json'
    });
  }
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});

test('no serious accessibility violations in presenter mode', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.digest-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Presenter mode/ }).click();
  await expect(page.locator('.presenter')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('.pdf-object')
    .analyze();

  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});
