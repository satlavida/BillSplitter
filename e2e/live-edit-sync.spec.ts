import { test, expect } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies
// sessionStore's PATCH-based sync of edits to an already-pushed bill/item
// (src/sessionStore.ts's updateBill diffing item/bill fields, liveApi.ts's
// updateLiveBill/updateLiveItem, server/internal/api's UpdateBill/UpdateItem
// handlers) — without this, only the *creation* of a bill/item reached the
// server; edits to price/title/etc. stayed local-only.

test('editing an already-live item and bill syncs to the server without disturbing an existing claim', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(/\/bill\/[^/]+\/step\/1$/);
  const billId = page.url().match(/\/bill\/([^/]+)\/step\/1$/)![1];
  await page.getByRole('button', { name: 'Go to step 2: Items' }).click();
  await page.getByPlaceholder('e.g., Pizza').fill('Nachos');
  await page.getByPlaceholder('0.00').first().fill('12.50');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await expect(page.getByText('Nachos')).toBeVisible();

  // A joiner claims the item before any edit happens.
  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Gale');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! Add items or claim what's yours.")).toBeVisible();
  await joinerPage.goto(`/#/join/${code}/bills/${billId}/step/3`);
  await expect(joinerPage.getByText('Nachos')).toBeVisible({ timeout: 10000 });
  await joinerPage.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(joinerPage.getByText('Claimed by Gale')).toBeVisible({ timeout: 10000 });

  // Creator edits the item's price and the bill's title on the creator page.
  await page.getByRole('button', { name: 'Edit Nachos' }).click();
  await page.getByLabel('Price').fill('15.00');
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Go to step 1: People' }).click();
  await page.getByText('Untitled Bill').click();
  const titleInput = page.locator('input[autocomplete="off"]');
  await titleInput.fill('Snacks (edited)');
  await titleInput.press('Enter');

  // The joiner's still-open page should reflect the new price without a
  // reload, and their claim should have survived the edit untouched.
  await expect(joinerPage.getByText('12.50')).not.toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByText('15.00')).toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByText('Claimed by Gale')).toBeVisible();
  await expect(joinerPage.getByText('Snacks (edited)')).toBeVisible({ timeout: 10000 });

  await joinerPage.close();
});
