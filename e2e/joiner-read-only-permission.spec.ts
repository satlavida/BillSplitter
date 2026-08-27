import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

// Runs against the real Go backend (server/). Covers req 6's read-only
// mode: joiners can view the creator's bills/items but cannot add items or
// claim/unclaim anything — enforced both in the UI (controls hidden/disabled)
// and server-side (requireEditPermission, see permission_mode_test.go).

const LIVE_SERVER_URL = 'http://localhost:8080';

test('read-only session: joiner sees items but cannot add or claim', async ({
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
  await page.locator('select').nth(1).selectOption({ label: 'Read-only (joiners can only view your changes)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Dinner', currency: 'USD' } });
  const bill = await billRes.json();
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Pizza', price: 20, quantity: 1 } });

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Grace');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! You can view the host's changes here.")).toBeVisible();

  // Step 2: Items — visible, but the add-item form's own button is disabled.
  await joinerPage.goto(`/#/join/${code}/bills/${bill.id}/step/1`);
  await expect(joinerPage.getByText('Pizza')).toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByRole('button', { name: '+ Add item' })).toBeDisabled();

  // Step 3: Assign — the claim control is disabled too.
  await joinerPage.goto(`/#/join/${code}/bills/${bill.id}/step/2`);
  await expect(joinerPage.getByRole('button', { name: 'Claim', exact: true })).toBeDisabled();

  await joinerPage.close();
});
