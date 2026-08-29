import { test, expect } from '@playwright/test';

// Covers req 10: "Who Paid?" is shown above the item summary/split
// breakdown on the Bill Summary step, not below it.

test('Who Paid appears above the split breakdown on the summary step', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByPlaceholder('Enter name').fill('Alice');
  await page.getByPlaceholder('Enter name').press('Enter');
  await expect(page.getByText('Alice')).toBeVisible();

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(/\/bill\/[^/]+\/step\/1$/);

  await page.getByPlaceholder('e.g., Pizza').fill('Pizza');
  await page.getByPlaceholder('0.00').first().fill('20');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('button', { name: 'Calculate Split' }).click();
  await expect(page.getByRole('heading', { name: 'Bill Summary' })).toBeVisible();

  const whoPaidHeading = page.getByRole('heading', { name: 'Who Paid?' });
  const splitBreakdownHeading = page.getByRole('heading', { name: 'Split Breakdown' });
  await expect(whoPaidHeading).toBeVisible();
  await expect(splitBreakdownHeading).toBeVisible();

  const whoPaidBox = await whoPaidHeading.boundingBox();
  const splitBreakdownBox = await splitBreakdownHeading.boundingBox();
  expect(whoPaidBox).not.toBeNull();
  expect(splitBreakdownBox).not.toBeNull();
  expect(whoPaidBox!.y).toBeLessThan(splitBreakdownBox!.y);

  // Split Breakdown is now a closed-by-default drawer — open it to see the
  // per-item mini card.
  await splitBreakdownHeading.click();
  await expect(page.getByText('All to Alice')).toBeVisible();
});
