import { expect, test } from '@playwright/test';

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
