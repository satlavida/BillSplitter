import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// These run against the real Go backend (server/), started alongside the
// Vite dev server via playwright.config.ts's webServer array. Verifies
// sessionStore's push of locally-added bills/items up to a live session
// (src/sessionStore.ts's addBill/updateBill, src/lib/liveApi.ts's
// addLiveBill/addLiveItem) — without this, a bill/item added through the
// normal offline-first UI never reached the server at all.

test('a bill and item added locally after going live show up for a joiner', async ({
  page,
  context,
}: {
  page: Page;
  context: BrowserContext;
}) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // Add a bill and an item to it *after* going live — this is the path
  // that previously never reached the server.
  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.getByRole('button', { name: 'Go to step 2: Items' }).click();
  await page.getByPlaceholder('e.g., Pizza').fill('Nachos');
  await page.getByPlaceholder('0.00').first().fill('12.50');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await expect(page.getByText('Nachos')).toBeVisible();

  // A joiner hitting the live session should see the bill/item without the
  // creator doing anything beyond the normal local Add Bill/Add Item flow.
  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Frank');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! Tap an item to claim it.")).toBeVisible();

  await expect(joinerPage.getByText('Nachos')).toBeVisible({ timeout: 10000 });
  await joinerPage.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(joinerPage.getByText('Claimed by Frank')).toBeVisible({ timeout: 10000 });

  await joinerPage.close();
});
