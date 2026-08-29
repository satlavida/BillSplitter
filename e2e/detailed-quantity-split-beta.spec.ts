import { test, expect } from '@playwright/test';

// Covers the "Show Detailed Quantity Split" beta setting end to end: off by
// default (existing FractionalSplitInput numeric-stepper UI, covered by
// quantity-split-defaults.spec.ts), on shows the dynamic dependent-claim
// number-grid UI (DependentQuantitySplitInput.tsx) instead.

test('enabling "Show Detailed Quantity Split" swaps in the dynamic pool UI for Quantity Split', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Show Detailed Quantity Split (beta)').check();

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
  // The dynamic UI's own copy, distinct from FractionalSplitInput's.
  await expect(drawer.getByText(/as others pick, the pool left for everyone else shrinks/)).toBeVisible();

  // Both start at the full quantity available (nobody's picked yet).
  await expect(drawer.getByRole('button', { name: 'John: 10' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Jane: 10' })).toBeVisible();

  await drawer.getByRole('button', { name: 'John: 6' }).click();
  // Jane's pool shrinks to 4 (10 - John's 6).
  await expect(drawer.getByRole('button', { name: 'Jane: 4' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Jane: 5' })).not.toBeVisible();

  await drawer.getByRole('button', { name: 'Jane: 4' }).click();
  await drawer.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Split between:', { exact: false })).toBeVisible();
});
