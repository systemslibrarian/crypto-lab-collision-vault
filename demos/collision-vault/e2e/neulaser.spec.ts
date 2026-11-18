import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { auditControlNames, formatControlNameFailures } from './control-names';

// The digests the analysis prints in Appendix A.2. The page is expected to
// COMPUTE these, so each assertion below also compares the computed fields
// with each other, not only with this text.
const PUBLISHED: Record<string, string> = {
  '512':
    'f899bf50663e6e04fa5374baf28886153ea332bf25443817eb2abbca88072458' +
    'dbd7a077712aae99fb112b7672c85a705700e027b348516cc45f8fff537713d3',
  '768':
    'ce762a05b18ab4fd659e6e601e4236d0908a59ef0feae7dfc71b9580af2f7a5e' +
    '3cd9e61caa7f2a59dec94cd7b45dc6f9b700a5260145a7f4531e6a207ffc8930' +
    '1f19c342a8a244c17df9140b9e37d9393aa63dd242bc5f9c47a1c8d7edd5094e',
  '1024':
    '9004dccd0bc7fb735b191dba252363bd283b6e8faa065725e74520c980ed34e2' +
    '2a13973901e7eb9bca06e47ced3a9f9dd50130787f4fe09e5014c5a8bb571e07' +
    '4174a9a260a81ad126e56fc19e1bd5d8a85c8635c5cc77f97da4290157f45d6d' +
    '0bbace9bb06e88e991d1222e811e0e7167a9d3c58512eaa67118ab2740aad8d2'
};

for (const width of [1280, 380]) {
  test(`Neulaser state-merge collision and its negative control at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('.');
    const panel = page.locator('#neulaser-2026');
    await expect(panel.getByRole('heading', { level: 2 })).toContainText('Neulaser');
    await expect(page.locator('#neulaser-status')).toContainText('first round');

    // Step 1: the search is run by the visitor and reports its own count.
    const search = page.locator('#neulaser-search-result');
    await expect(search).toHaveText('Not run yet.');
    await page.locator('#neulaser-search').click();
    await expect(search).toContainText('x = 0002ad84');
    await expect(search).toContainText('x = 00002743');
    await expect(search).toContainText('175,493 feedback evaluations');
    const feedbackRow = page.locator('#neulaser-feedback-table tbody tr').last();
    await expect(feedbackRow.locator('td').nth(0)).toHaveText('8c41db68');
    await expect(feedbackRow.locator('td').nth(1)).toHaveText(
      await feedbackRow.locator('td').nth(0).innerText()
    );

    const digestA = page.locator('#neulaser-digest-a');
    const digestB = page.locator('#neulaser-digest-b');
    const verdict = page.locator('#neulaser-verdict');
    for (const [variant, words] of [['512', 48], ['768', 64], ['1024', 80]] as const) {
      await page.selectOption('#neulaser-variant', variant);
      // Step 2: one differing word before the update, none after.
      await expect(page.locator('#neulaser-merge-before')).toContainText(`1 of ${words} state words differ`);
      await expect(page.locator('#neulaser-merge-after')).toContainText(`0 of ${words} state words differ`);
      await expect(page.locator('#neulaser-state td.neulaser-differs')).toHaveCount(2);
      // Step 3: both computed digests are the published one.
      await expect(digestA).toHaveText(PUBLISHED[variant]);
      await expect(digestB).toHaveText(await digestA.innerText());
      await expect(verdict).toContainText(`Verified: two different`);
      await expect(verdict).toContainText(`Neulaser-${variant} digest`);
    }

    // Step 4: flipping one bit of one message breaks it, at several places.
    await page.selectOption('#neulaser-variant', '512');
    await page.check('#neulaser-flip');
    for (const byte of ['0', '56', '59', '119']) {
      await page.fill('#neulaser-flip-byte', byte);
      await page.locator('#neulaser-flip-byte').dispatchEvent('change');
      await expect(verdict).toContainText('Negative control: the digests differ');
      await expect(digestA).toHaveText(PUBLISHED['512']);
      await expect(digestB).not.toHaveText(PUBLISHED['512']);
      await expect(page.locator('#neulaser-merge-after')).not.toContainText('0 of 48');
    }
    await page.uncheck('#neulaser-flip');
    await expect(verdict).toContainText('Verified');
    await expect(digestB).toHaveText(PUBLISHED['512']);

    await panel.locator('summary').click();
    await expect(page.locator('#neulaser-message-a')).toBeVisible();
    await expect(panel).toContainText('not from the submitters’ code');

    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    const scan = await new AxeBuilder({ page })
      .include('#neulaser-2026')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(scan.violations).toEqual([]);
    // axe's `label` rule accepts a bare `placeholder` as an accessible name. See `control-names.ts`.
    expect(
      formatControlNameFailures(await auditControlNames(page)),
      `form controls named only by placeholder/title at ${width}px`
    ).toEqual([]);
  });
}
