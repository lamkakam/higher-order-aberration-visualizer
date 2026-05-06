import { expect, type Page, test } from '@playwright/test';

const stickyTopTolerancePx = 2;
const scrollMovementThresholdPx = 40;

async function getCardTopByHeading(page: Page, heading: string) {
  const card = page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]');
  await expect(card).toBeVisible();

  return card.evaluate((element) => element.getBoundingClientRect().top);
}

async function expectCardIsTopmost(page: Page, heading: string) {
  const card = page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]');
  await expect(card).toBeVisible();

  await expect(
    card.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const points = [
        { x: rect.left + rect.width / 2, y: rect.top + 16 },
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        { x: rect.left + rect.width / 2, y: rect.bottom - 16 }
      ];

      return points.every(({ x, y }) => {
        const topElement = document.elementFromPoint(x, y);

        return topElement ? element.contains(topElement) : false;
      });
    })
  ).resolves.toBe(true);
}

async function expectPrimaryStickyGapIsMasked(page: Page) {
  const card = page
    .getByRole('heading', { name: 'Simulated Image' })
    .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]');
  await expect(card).toBeVisible();

  await expect(
    card.evaluate((element) => {
      const stickyWrapper = element.parentElement;
      const rect = element.getBoundingClientRect();
      const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top / 2);

      return Boolean(stickyWrapper && topElement === stickyWrapper);
    })
  ).resolves.toBe(true);
}

async function expectPrimaryCardSticks(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 260));
  const stuckTop = await getCardTopByHeading(page, 'Simulated Image');

  await page.evaluate(() => window.scrollTo(0, 620));
  await expect(page.getByRole('heading', { name: 'Simulated Image' })).toBeVisible();
  const laterTop = await getCardTopByHeading(page, 'Simulated Image');

  expect(Math.abs(laterTop - stuckTop)).toBeLessThanOrEqual(stickyTopTolerancePx);
  await expectCardIsTopmost(page, 'Simulated Image');
}

async function expectCardSticks(page: Page, heading: string, initialTop: number) {
  expect(Math.abs((await getCardTopByHeading(page, heading)) - initialTop)).toBeLessThanOrEqual(
    stickyTopTolerancePx
  );
}

async function enableAdvancedMode(page: Page) {
  await page.getByRole('button', { name: 'Setting' }).click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.mouse.click(20, 20);
  await expect(page.getByText('Mode')).toBeHidden();
}

test('app loads the simulator controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('HOA Visualizer')).toBeVisible();
  await expect(page.getByText('Optical Aberration Simulator')).toBeVisible();

  await page.getByRole('button', { name: 'Setting' }).click();
  await expect(page.getByText('Mode')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Light' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'System' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
  await expect(page.getByText('Display')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Basic' })).toBeVisible();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('heading', { name: 'Optical System Config' })).toBeVisible();
  await expect(page.getByLabel('Aperture Diameter (mm)')).toHaveValue('3');
  await expect(page.getByLabel('Target')).toContainText('Snellen Chart Letter E on 20/20');
  await expect(page.getByRole('heading', { name: 'Optical Aberrations (Zernike)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset aberrations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simulated Image' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PSF' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wavefront Map' })).toBeVisible();
});

test('keeps the simulated image card sticky in basic mode on desktop', async ({ page }) => {
  await page.goto('/');

  await expectPrimaryCardSticks(page);
});

test('masks the gap above the sticky simulated image card on desktop', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => window.scrollTo(0, 620));
  await expectPrimaryStickyGapIsMasked(page);
});

test('keeps all advanced image cards sticky on desktop', async ({ page }) => {
  await page.goto('/');
  await enableAdvancedMode(page);

  await page.evaluate(() => window.scrollTo(0, 260));
  const primaryTop = await getCardTopByHeading(page, 'Simulated Image');
  const psfTop = await getCardTopByHeading(page, 'PSF');
  const wavefrontTop = await getCardTopByHeading(page, 'Wavefront Map');

  await page.evaluate(() => window.scrollTo(0, 620));
  await expect(page.getByRole('heading', { name: 'Simulated Image' })).toBeVisible();

  await expectCardSticks(page, 'Simulated Image', primaryTop);
  await expectCardSticks(page, 'PSF', psfTop);
  await expectCardSticks(page, 'Wavefront Map', wavefrontTop);
  await expectCardIsTopmost(page, 'Simulated Image');
});

test('keeps the simulated image card sticky in basic mode on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');

  await expectPrimaryCardSticks(page);
});

test('keeps the simulated image card sticky in advanced mode on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await enableAdvancedMode(page);

  await page.evaluate(() => window.scrollTo(0, 260));
  const primaryTop = await getCardTopByHeading(page, 'Simulated Image');
  const psfTop = await getCardTopByHeading(page, 'PSF');
  const wavefrontTop = await getCardTopByHeading(page, 'Wavefront Map');

  await page.evaluate(() => window.scrollTo(0, 620));
  await expect(page.getByRole('heading', { name: 'Simulated Image' })).toBeVisible();

  await expectCardSticks(page, 'Simulated Image', primaryTop);
  await expectCardIsTopmost(page, 'Simulated Image');
  expect((await getCardTopByHeading(page, 'PSF')) - psfTop).toBeLessThan(-scrollMovementThresholdPx);
  expect((await getCardTopByHeading(page, 'Wavefront Map')) - wavefrontTop).toBeLessThan(
    -scrollMovementThresholdPx
  );
});
