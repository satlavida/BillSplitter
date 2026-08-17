import { test, expect } from '@playwright/test';

// Runs against the static frontend only (no live server needed). Regression
// test for a bug where switching an item's split type from Equal to
// Quantity Split before anyone had been toggled on (item.consumedBy still
// empty) left SplitTypeDrawer.tsx's Percentage/Quantity Split screens with
// no people to configure and Save permanently disabled — see
// FractionalSplitInput.tsx/SplitTypeDrawer.tsx's splitPeople fallback.

test('switching an unassigned item to Quantity Split defaults parts to the item quantity', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];
  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));

  await page.getByPlaceholder('Enter name').fill('Alice');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByPlaceholder('Enter name').fill('Bob');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();
  await page.getByPlaceholder('e.g., Pizza').fill('Pizza Slices');
  await page.getByPlaceholder('0.00').first().fill('30');
  await page.locator('input[type="number"][min="1"]').fill('3');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: nobody has been toggled on for this item yet — go straight to
  // configuring the split without clicking Alice/Bob first.
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
  await page.getByLabel('Configure Split').click();
  await page.locator('select').selectOption({ label: 'Quantity Split' });

  // Both people should have a part row, defaulting to the item's quantity
  // (3) split evenly between them, and Save should be enabled immediately.
  const drawer = page.locator('.animate-slide-up');
  await expect(drawer.getByText('Alice')).toBeVisible();
  await expect(drawer.getByText('Bob')).toBeVisible();
  await expect(drawer.getByText('item has 3')).toBeVisible();
  const saveButton = drawer.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.getByText('Split between:', { exact: false })).toBeVisible();
  await expect(page.getByText('Quantity Split', { exact: true })).toBeVisible();
});
