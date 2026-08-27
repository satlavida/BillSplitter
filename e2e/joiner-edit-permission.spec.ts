import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

// Runs against the real Go backend (server/). Covers req 6's edit mode
// (the default): joiners can both add new items and claim/unclaim
// directly, no approval step for either.

const LIVE_SERVER_URL = 'http://localhost:8080';

test('edit session: joiner can add an item and claim it', async ({
  page,
  context,
  request,
}: {
  page: Page;
  context: BrowserContext;
  request: APIRequestContext;
}) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  // 'edit' is the default — no need to touch the second select.
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Dinner', currency: 'USD' } });
  const bill = await billRes.json();

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Frank');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! Add items or claim what's yours.")).toBeVisible();

  // Step 2: Items — where a joiner can add a new item (req 4/6).
  await joinerPage.goto(`/#/join/${code}/bills/${bill.id}/step/1`);
  await joinerPage.getByRole('button', { name: '+ Add item' }).click();
  await joinerPage.getByPlaceholder('Item name').fill('Salad');
  await joinerPage.getByPlaceholder('Price').fill('8.50');
  await joinerPage.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(joinerPage.getByText('Salad')).toBeVisible({ timeout: 10000 });

  // Step 3: Assign — claim it.
  await joinerPage.goto(`/#/join/${code}/bills/${bill.id}/step/2`);
  await joinerPage.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(joinerPage.getByText('Claimed by Frank')).toBeVisible({ timeout: 10000 });

  await joinerPage.close();
});
