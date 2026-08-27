import { test, expect } from '@playwright/test';

// The bill wizard's steps are real routes (/session/:id/bill/:id/step/:n),
// not just React state, so browser back/forward moves between them like any
// other navigation.

test('browser back/forward moves between wizard steps', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(/#\/session\/[^/]+\/bill\/[^/]+\/step\/1$/);
  await expect(page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();

  await page.getByPlaceholder('e.g., Pizza').fill('Pizza');
  await page.getByPlaceholder('0.00').first().fill('20');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForURL(/\/step\/2$/);
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();

  await page.goBack();
  await page.waitForURL(/\/step\/1$/);
  await expect(page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();

  await page.goForward();
  await page.waitForURL(/\/step\/2$/);
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
});
