import { expect, test, type Page } from '@playwright/test';

async function selectBoundaryContrast(page: Page): Promise<number> {
  return page.locator('.tamper-select').first().evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (color: string): number => {
      const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const border = luminance(style.borderTopColor);
    const background = luminance(style.backgroundColor);
    return (Math.max(border, background) + 0.05) / (Math.min(border, background) + 0.05);
  });
}

test('tamper-select boundary clears WCAG non-text contrast', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.tamper-select').first()).toBeVisible({ timeout: 20_000 });
  expect(await selectBoundaryContrast(page)).toBeGreaterThanOrEqual(3);
});
