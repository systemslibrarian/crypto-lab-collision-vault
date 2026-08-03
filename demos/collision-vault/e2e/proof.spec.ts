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

// ── 9 · suffix extension: minting a brand-new colliding pair ────────────────
// The panel's whole point is that a published collision is a reusable seed, so
// the success path AND both failure paths are asserted from the digests the
// page actually rendered, never from the copy around them.

test.describe('9 · mint your own colliding pair', () => {
  test.beforeEach(async ({ page }) => {
    await page.locator('#pair-md5-ipc').check();
    await expect(page.locator('.extend-panel')).toBeVisible({ timeout: 20_000 });
  });

  test('the three suffix-closure preconditions are measured and all hold', async ({ page }) => {
    const checks = page.locator('.extend-checks .extend-check');
    await expect(checks).toHaveCount(3);
    await expect(page.locator('.extend-checks .extend-check.fail')).toHaveCount(0);
    // Each condition names the number it was decided from, not just a verdict.
    await expect(checks.nth(0)).toContainText('complete 64-byte blocks');
    await expect(checks.nth(1)).toContainText('chaining values agree after block');
    await expect(checks.nth(2)).toContainText('past the last complete block are identical');
    await expect(page.locator('.extend-verdict-pre')).toContainText('suffix-closed');
  });

  test('appending the same bytes to both halves mints a NEW colliding pair', async ({ page }) => {
    const published = (await page.locator('.digest-panel .digest-value').first().innerText()).trim();

    await page.locator('#extend-suffix-a').fill('\nDELIVER THE GOLD TO EVE\n');
    await page.locator('.extend-run').click();

    const result = page.locator('.extend-result');
    await expect(result).toContainText('STILL COLLIDES', { timeout: 20_000 });
    await expect(result).toHaveClass(/is-alarm/);

    // The verdict must agree with the digests actually rendered beside it.
    const digests = result.locator('.digest-value');
    await expect(digests).toHaveCount(2);
    const dA = (await digests.nth(0).innerText()).trim();
    const dB = (await digests.nth(1).innerText()).trim();
    expect(dA).toBe(dB);
    expect(dA).not.toBe('');
    // …and it is a collision that did not exist before the click.
    expect(dA).not.toBe(published);
    await expect(result).toContainText('different digest from the published pair');

    // The prediction was made from the structure before hashing, and matched.
    await expect(result).toContainText('Predicted before hashing: digests equal');
    await expect(result).not.toContainText('PREDICTION MISMATCH');
  });

  test('failure path: different bytes on File B break the collision', async ({ page }) => {
    await page.locator('.extend-panel select').selectOption('differ');
    await page.locator('#extend-suffix-a').fill('PAY EVE');
    await page.locator('#extend-suffix-b').fill('PAY BOB');
    await page.locator('.extend-run').click();

    const result = page.locator('.extend-result');
    await expect(result).toContainText('COLLISION BROKEN', { timeout: 20_000 });
    await expect(result).toContainText('appended bytes were not identical');
    await expect(result).toHaveClass(/is-ok/);
    await expect(result).toContainText('Predicted before hashing: digests differ');

    const digests = result.locator('.digest-value');
    const dA = (await digests.nth(0).innerText()).trim();
    const dB = (await digests.nth(1).innerText()).trim();
    expect(dA).not.toBe(dB);
    await expect(result).not.toContainText('PREDICTION MISMATCH');
  });

  test('failure path: appending to File A only breaks the collision', async ({ page }) => {
    await page.locator('.extend-panel select').selectOption('a-only');
    await page.locator('#extend-suffix-a').fill('x');
    await page.locator('.extend-run').click();

    const result = page.locator('.extend-result');
    await expect(result).toContainText('COLLISION BROKEN', { timeout: 20_000 });
    await expect(result).toContainText('Appended 1 bytes to File A and 0 to File B');
    const digests = result.locator('.digest-value');
    expect((await digests.nth(0).innerText()).trim()).not.toBe(
      (await digests.nth(1).innerText()).trim()
    );
  });

  test('the same construction works on the SHA-1 SHAttered pair', async ({ page }) => {
    await page.locator('#pair-shattered').check();
    await expect(page.locator('.extend-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.extend-verdict-pre')).toContainText('suffix-closed');
    await page.locator('#extend-suffix-a').fill('\n% grown from SHAttered\n');
    await page.locator('.extend-run').click();
    const result = page.locator('.extend-result');
    await expect(result).toContainText('STILL COLLIDES', { timeout: 40_000 });
    const digests = result.locator('.digest-value');
    expect((await digests.nth(0).innerText()).trim()).toBe(
      (await digests.nth(1).innerText()).trim()
    );
  });
});
