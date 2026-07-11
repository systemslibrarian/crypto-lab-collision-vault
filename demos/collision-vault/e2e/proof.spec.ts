import { test, expect } from '@playwright/test';

const PAIRS = [
  { id: 'shattered', broken: 'SHA-1', isPdf: true },
  { id: 'md5-ipc', broken: 'MD5', isPdf: false },
  { id: 'md5-cpc', broken: 'MD5', isPdf: false }
];

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  // The self-test gate must pass before any digests are shown.
  await expect(page.locator('.status-calm')).toContainText('validated against known test vectors', {
    timeout: 20_000
  });
});

test('default pair shows a live collision and modern-hash resistance', async ({ page }) => {
  await expect(page.locator('.digest-panel')).toContainText('SAME DIGEST, DIFFERENT FILES', {
    timeout: 20_000
  });
  await expect(page.locator('.resistance-panel')).toContainText('RESISTANCE HOLDS');
  // Verification ledger: all seven invariants pass.
  await expect(page.locator('.ledger-panel .panel-head')).toContainText('7/7 checks pass');
  await expect(page.locator('.ledger-item.fail')).toHaveCount(0);
  // State trace: the independent implementation shows the re-convergence.
  await expect(page.locator('.trace-panel')).toContainText('RE-CONVERGED');
});

for (const pair of PAIRS) {
  test(`pair "${pair.id}" verifies: broken digests equal, ledger all pass`, async ({ page }) => {
    await page.locator(`#pair-${pair.id}`).check();
    const digest = page.locator('.digest-panel');
    await expect(digest).toContainText(`Broken hash: ${pair.broken}`, { timeout: 20_000 });
    await expect(digest).toContainText('SAME DIGEST, DIFFERENT FILES');
    await expect(page.locator('.ledger-item.fail')).toHaveCount(0);
    // Source citation is surfaced in the UI.
    await expect(page.locator('.citation')).toContainText('Source:');
    if (pair.isPdf) {
      await expect(page.locator('.pdf-object').first()).toBeVisible();
    }
  });
}

test('one-byte tamper breaks the collision', async ({ page }) => {
  await page.locator('#pair-md5-ipc').check();
  await expect(page.locator('.tamper-panel')).toBeVisible({ timeout: 20_000 });
  await page.locator('.tamper-flip').click();
  await expect(page.locator('.tamper-result.is-alarm')).toContainText('collision BROKEN', {
    timeout: 15_000
  });
});

test('presenter mode opens and steps forward', async ({ page }) => {
  await expect(page.locator('.digest-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Presenter mode/ }).click();
  await expect(page.locator('.presenter')).toBeVisible();
  await expect(page.locator('.presenter-counter')).toContainText('Step 1 / 7');
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.locator('.presenter-counter')).toContainText('Step 2 / 7');
  // Esc exits back to the normal view.
  await page.keyboard.press('Escape');
  await expect(page.locator('.presenter')).toHaveCount(0);
  await expect(page.locator('.digest-panel')).toBeVisible();
});

test('mobile: byte-diff A/B toggle switches the active file', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only layout');
  await page.locator('#pair-md5-ipc').check();
  const panels = page.locator('.bytediff-panels');
  await expect(panels).toBeVisible({ timeout: 20_000 });
  await expect(panels).toHaveAttribute('data-active', 'A');
  await page.getByRole('button', { name: 'File B', exact: true }).click();
  await expect(panels).toHaveAttribute('data-active', 'B');
});
