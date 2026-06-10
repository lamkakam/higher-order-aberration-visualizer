import { expect, type Page, test } from '@playwright/test';

const stickyTopTolerancePx = 2;
const scrollMovementThresholdPx = 40;

async function waitForWorkerInitialization(page: Page) {
  await expect(page.getByRole('status', { name: 'Worker initialization' })).toBeHidden({
    timeout: 60_000
  });
}

async function openAppAndAcceptTerms(page: Page) {
  await page.goto('/');
  const termsModal = page.getByRole('dialog', { name: 'Terms of Use' });

  await expect(termsModal).toBeVisible();
  await expect(termsModal.getByRole('link', { name: 'full terms' })).toHaveAttribute(
    'href',
    'https://redirect.github.com/lamkakam/higher-order-aberration-visualizer/blob/main/LICENSE'
  );
  await termsModal.getByRole('button', { name: 'Agree' }).click();
  await expect(termsModal).toBeHidden();
}

async function getCardTopByHeading(page: Page, heading: string) {
  const card = page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]');
  await expect(card).toBeVisible();

  return card.evaluate((element) => element.getBoundingClientRect().top);
}

async function getCardHeightByHeading(page: Page, heading: string) {
  const card = page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]');
  await expect(card).toBeVisible();

  return card.evaluate((element) => element.getBoundingClientRect().height);
}

async function waitForPrimaryImageReady(page: Page) {
  await waitForWorkerInitialization(page);
  await expect(
    page.getByRole('button', { name: 'Open enlarged Simulated Image image' })
  ).toBeVisible({ timeout: 60_000 });
}

async function expectCardIsTopmost(page: Page, heading: string) {
  await waitForWorkerInitialization(page);
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
  await waitForPrimaryImageReady(page);
  await page.evaluate(() => window.scrollTo(0, 900));
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

async function expectAdvancedStickyGapsAreMasked(page: Page) {
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
  await waitForPrimaryImageReady(page);
  await page.evaluate(() => window.scrollTo(0, 620));
  const stuckTop = await getCardTopByHeading(page, 'Simulated Image');

  await page.evaluate(() => window.scrollTo(0, 900));
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
  await waitForWorkerInitialization(page);
  await page.getByRole('button', { name: 'Setting' }).click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.mouse.click(20, 20);
  await expect(page.getByText('Mode', { exact: true })).toBeHidden();
}

async function enableDarkMode(page: Page) {
  await page.getByRole('button', { name: 'Setting' }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await page.mouse.click(20, 20);
  await expect(page.getByText('Mode', { exact: true })).toBeHidden();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).resolves.toBe(true);
}

async function expectVisibleCardGuttersMatch(page: Page, heading: string) {
  const card = page
    .getByRole('heading', { name: heading })
    .locator('xpath=ancestor::*[contains(@class, "MuiCard-root")]');
  await expect(card).toBeVisible();

  const gutters = await card.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      left: rect.left,
      right: window.innerWidth - rect.right
    };
  });

  expect(gutters.left).toBeGreaterThan(0);
  expect(gutters.right).toBeGreaterThan(0);
  expect(Math.abs(gutters.left - gutters.right)).toBeLessThanOrEqual(1);
}

test('app loads the simulator controls', async ({ page }) => {
  await openAppAndAcceptTerms(page);

  await expect(page.getByText('Higher-Order Aberration Simulator')).toBeVisible();

  await page.getByRole('button', { name: 'Setting' }).click();
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en');
  await expect(page.getByText('Mode')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Light' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'System' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
  await expect(page.getByText('Display')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Basic' })).toBeVisible();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('heading', { name: 'Optical System Config' })).toBeVisible();
  await expect(page.getByLabel('Aperture Diameter (mm)')).toHaveValue('6');
  await expect(page.getByLabel('Target')).toContainText('Eye Chart (logMAR)');
  await expectOpticalConfigLabelIsLeftOfControl(page, 'Aperture Diameter (mm)');
  await expectOpticalConfigLabelIsLeftOfControl(page, 'Target');
  await expect(page.getByRole('textbox', { name: 'FWHM Seeing (arcsecond)' })).toHaveValue('0.00');
  await expect(page.getByRole('heading', { name: 'Optical Aberrations (Zernike)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset aberrations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simulated Image' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PSF' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wavefront Map' })).toBeVisible();
});

async function expectOpticalConfigLabelIsLeftOfControl(page: Page, labelText: string) {
  const label = page.locator('label', { hasText: labelText });
  const control = page.getByLabel(labelText);
  await expect(label).toBeVisible();
  await expect(control).toBeVisible();

  const [labelBox, controlBox] = await Promise.all([label.boundingBox(), control.boundingBox()]);
  expect(labelBox).not.toBeNull();
  expect(controlBox).not.toBeNull();

  if (!labelBox || !controlBox) {
    return;
  }

  expect(labelBox.x + labelBox.width).toBeLessThan(controlBox.x);
  expect(Math.abs(labelBox.y - controlBox.y)).toBeLessThanOrEqual(12);
}

async function expectAdvancedConfigTextIsLeftOfControl(
  page: Page,
  text: string,
  control: ReturnType<Page['getByRole']>
) {
  const label = page.getByText(text, { exact: true });
  await expect(label).toBeVisible();
  await expect(control).toBeVisible();

  const [labelBox, controlBox] = await Promise.all([label.boundingBox(), control.boundingBox()]);
  expect(labelBox).not.toBeNull();
  expect(controlBox).not.toBeNull();

  if (!labelBox || !controlBox) {
    return;
  }

  expect(labelBox.x + labelBox.width).toBeLessThan(controlBox.x);
}

async function expectTextIsBelowText(page: Page, lowerText: string, upperText: string) {
  const lower = page.getByText(lowerText, { exact: true });
  const upper = page.getByText(upperText, { exact: true });
  await expect(lower).toBeVisible();
  await expect(upper).toBeVisible();

  const [lowerBox, upperBox] = await Promise.all([lower.boundingBox(), upper.boundingBox()]);
  expect(lowerBox).not.toBeNull();
  expect(upperBox).not.toBeNull();

  if (!lowerBox || !upperBox) {
    return;
  }

  expect(lowerBox.y).toBeGreaterThan(upperBox.y);
  expect(Math.abs(lowerBox.x - upperBox.x)).toBeLessThanOrEqual(2);
}

test('keeps the simulated image card sticky in basic mode on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openAppAndAcceptTerms(page);

  await expectPrimaryCardSticks(page);
});

test('masks the gap above the sticky simulated image card on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openAppAndAcceptTerms(page);

  await expectPrimaryStickyGapIsMasked(page);
});

test('keeps all advanced image cards sticky on desktop', async ({ page }) => {
  await openAppAndAcceptTerms(page);
  await enableAdvancedMode(page);
  await expectAdvancedConfigTextIsLeftOfControl(
    page,
    'Aperture Mask',
    page.getByRole('button', { name: 'Edit aperture mask' })
  );
  await expectAdvancedConfigTextIsLeftOfControl(
    page,
    'Circle, 0% obstruction',
    page.getByRole('button', { name: 'Edit aperture mask' })
  );
  await expectAdvancedConfigTextIsLeftOfControl(
    page,
    'Spectral Mode',
    page.getByRole('button', { name: 'Monochromatic' })
  );
  await expectTextIsBelowText(page, 'Circle, 0% obstruction', 'Aperture Mask');

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

test('keeps advanced image cards equal height on desktop', async ({ page }) => {
  await openAppAndAcceptTerms(page);
  await enableAdvancedMode(page);

  const heights = await Promise.all(
    ['Simulated Image', 'PSF', 'Wavefront Map'].map((heading) =>
      getCardHeightByHeading(page, heading)
    )
  );
  const tallestHeight = Math.max(...heights);
  const shortestHeight = Math.min(...heights);

  expect(tallestHeight - shortestHeight).toBeLessThanOrEqual(1);
});

test('masks the advanced sticky card gutters and top gaps on desktop', async ({ page }) => {
  await openAppAndAcceptTerms(page);
  await enableAdvancedMode(page);

  await page.evaluate(() => window.scrollTo(0, 620));
  await expectAdvancedStickyGapsAreMasked(page);
});

test('keeps the simulated image card sticky in basic mode on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await openAppAndAcceptTerms(page);

  await expectPrimaryCardSticks(page);
});

test('preserves card gutters without horizontal overflow on small dark screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openAppAndAcceptTerms(page);
  await enableDarkMode(page);
  await waitForPrimaryImageReady(page);

  await page.evaluate(() => window.scrollTo(0, 620));
  await expect(page.getByRole('heading', { name: 'Simulated Image' })).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await expectVisibleCardGuttersMatch(page, 'Simulated Image');
});

test('keeps 6th-order zernike slider labels and textboxes inside mobile cards', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openAppAndAcceptTerms(page);
  await waitForWorkerInitialization(page);

  const sixthOrderSummary = page.getByRole('button', { name: '6th Order' });
  await sixthOrderSummary.scrollIntoViewIfNeeded();

  const sixthOrderAccordion = sixthOrderSummary.locator(
    'xpath=ancestor::*[contains(@class, "MuiAccordion-root")]'
  );
  const zernikeTextbox = page.getByRole('textbox', {
    name: 'Secondary Quadrafoil (Oblique) Z(6,-4) coefficient'
  });
  const firstLabelChip = sixthOrderAccordion.getByText('Sec. Quadrafoil', { exact: true }).first();

  await expect(zernikeTextbox).toBeVisible();
  await expect(firstLabelChip).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const bounds = await zernikeTextbox.evaluate((input) => {
    const inputGroup = input.closest('.MuiBox-root');
    const accordion = input.closest('.MuiAccordion-root');
    const labelChip = inputGroup?.parentElement?.querySelector('.MuiChip-root');

    if (!inputGroup || !accordion || !labelChip) {
      throw new Error('Expected zernike textbox, accordion, and label chip to be rendered.');
    }

    const inputGroupRect = inputGroup.getBoundingClientRect();
    const accordionRect = accordion.getBoundingClientRect();
    const labelChipRect = labelChip.getBoundingClientRect();

    return {
      accordionLeft: accordionRect.left,
      accordionRight: accordionRect.right,
      inputGroupLeft: inputGroupRect.left,
      inputGroupRight: inputGroupRect.right,
      inputGroupTop: inputGroupRect.top,
      labelChipTop: labelChipRect.top
    };
  });

  expect(bounds.inputGroupLeft).toBeGreaterThanOrEqual(bounds.accordionLeft);
  expect(bounds.inputGroupRight).toBeLessThanOrEqual(bounds.accordionRight);
  expect(Math.abs(bounds.inputGroupTop - bounds.labelChipTop)).toBeLessThanOrEqual(2);
});

test('keeps the simulated image card sticky in advanced mode on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openAppAndAcceptTerms(page);
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
