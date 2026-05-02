import { expect, test } from '@playwright/test';

test('app loads and placeholder compute is visible', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Client-only optics scaffold' })).toBeVisible();
  await expect(page.getByTestId('worker-status')).toBeVisible();

  await page.getByRole('button', { name: 'Compute' }).click();
  await expect(page.getByTestId('compute-status')).toContainText(/Computed|failed|Failed/i);
});
