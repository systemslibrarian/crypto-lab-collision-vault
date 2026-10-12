import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [1280,380])test(`published SHA256 pair and negative controls at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('.');
 const verdict=page.locator('#sha2-research-verdict');
 await expect(verdict).toContainText('Verified: the published 36-step');
 await expect(page.locator('#sha2-chain-a')).toHaveText('79df307814339285d39ae368142866bcba063acffa4431c6a5d74825c4be00db');
 await expect(page.locator('#sha2-chain-b')).toHaveText(await page.locator('#sha2-chain-a').innerText());
 await expect(page.locator('#sha2-full-a')).toHaveText('fc3d142874455bd7ba8955078e5b2b1b2390377d8c4f668d0fae4b98fc0f39da');
 await expect(page.locator('#sha2-full-b')).toHaveText('fec178d5055397c61a3b92a1de7aeb4c8482ffdfcfbc91b057b641f19033308d');
 await page.check('#sha2-research-mutate');await expect(verdict).toContainText('Negative control');
 await page.uncheck('#sha2-research-mutate');await expect(verdict).toContainText('Verified');
 for(const steps of ['35','64']){await page.selectOption('#sha2-research-steps',steps);await expect(verdict).toContainText('Negative control');}
 await page.selectOption('#sha2-research-steps','36');await expect(verdict).toContainText('Verified');
 await page.locator('#sha2-pair-verifier summary').click();
 await expect(page.locator('#sha2-message-a')).toBeVisible();
 await expect(page.locator('#sha2-pair-verifier')).toContainText('no extra padding is added', {ignoreCase:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 const scan=await new AxeBuilder({page}).include('#sha2-pair-verifier').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(scan.violations).toEqual([]);
});
