import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Covers req 5: a session created offline (before ever going live) with
// bills already on it must have those pre-existing bills/items pushed up
// the moment "Go Live" is activated — see sessionStore.ts's
// syncExistingBillsLive, called from markSessionLive. Before that fix,
// only bills/items added *after* going live were ever pushed (see
// live-bill-sync.spec.ts), so a session that already had bills showed none
// of them server-side until each bill was individually re-edited.

test('bills added before going live are visible to a joiner immediately after activation', async ({
  page,
  context,
}: {
  page: Page;
  context: BrowserContext;
}) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionUrl = page.url();

  // Add a bill and an item to it *before* going live at all.
  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.getByRole('button', { name: 'Go to step 2: Items' }).click();
  await page.getByPlaceholder('e.g., Pizza').fill('Nachos');
  await page.getByPlaceholder('0.00').first().fill('12.50');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await expect(page.getByText('Nachos')).toBeVisible();

  // Back to session home, now with a pre-existing bill, then go live.
  await page.goto(sessionUrl);
  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // A joiner should see the pre-existing bill/item without the creator
  // touching anything after activation.
  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Grace');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! Add items or claim what's yours.")).toBeVisible();

  await expect(joinerPage.getByText('Nachos')).toBeVisible({ timeout: 10000 });

  await joinerPage.close();
});
