import { test, expect } from '@playwright/test';

// Covers req 16: the settlement page lists every bill compactly with its
// total, alongside the existing balances/who-pays-whom sections.

test('settlement page lists bills with their totals', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(/\/bill\/[^/]+\/step\/1$/);
  await page.getByPlaceholder('Enter name').fill('Alice');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByPlaceholder('e.g., Pizza').fill('Pizza');
  await page.getByPlaceholder('0.00').first().fill('20');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('button', { name: 'Calculate Split' }).click();

  await page.goto(`/#/session/${sessionId}/settlement`);
  await expect(page.getByRole('heading', { name: 'Bills' })).toBeVisible();
  await expect(page.getByText('Untitled Bill')).toBeVisible();
  await expect(page.getByText('$20.00')).toBeVisible();
});
