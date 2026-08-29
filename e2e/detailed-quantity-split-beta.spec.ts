import { test, expect } from '@playwright/test';

// Covers the "Use Detailed Quantity Split" beta setting end to end: off by
// default (Basic view — the dynamic dependent-claim number-grid UI,
// DependentQuantitySplitInput.tsx, covered by quantity-split-defaults.spec.ts),
// on swaps in the legacy independent-entry Detailed view (FractionalSplitInput.tsx)
// instead.

test('enabling "Use Detailed Quantity Split" swaps in the independent-entry UI for Quantity Split', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Use Detailed Quantity Split (beta)').check();

  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await page.getByPlaceholder('Enter name').fill('John');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByPlaceholder('Enter name').fill('Jane');
  await page.getByPlaceholder('Enter name').press('Enter');

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));

  await page.getByPlaceholder('e.g., Pizza').fill('Cola');
  await page.getByPlaceholder('0.00').first().fill('20');
  await page.locator('input[type="number"][min="1"]').fill('10');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
  await page.getByLabel('Split Type').click();
  await page.locator('select').selectOption({ label: 'Quantity Split' });

  const drawer = page.locator('.animate-slide-up');
  // The independent-entry Detailed view's own copy, distinct from the
  // Basic view's dynamic-pool copy.
  await expect(drawer.getByText(/Give each person a number of shares/)).toBeVisible();

  // Defaults to the item's quantity split evenly across both people.
  await expect(drawer.getByLabel("John's share")).toHaveValue('5');
  await expect(drawer.getByLabel("Jane's share")).toHaveValue('5');

  await drawer.getByLabel("John's share").fill('6');
  await drawer.getByLabel("Jane's share").fill('4');
  await drawer.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Split between:', { exact: false })).toBeVisible();
});
