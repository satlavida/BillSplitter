import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array.

const LIVE_SERVER_URL = 'http://localhost:8080';

async function goLive(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Free select (joiners claim items directly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  return page.locator('span.font-mono.font-semibold').first().innerText();
}

async function seedBillWithItem(request: APIRequestContext, code: string): Promise<{ billId: string; itemId: string }> {
  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Snacks', currency: 'USD' } });
  const bill = await billRes.json();
  const itemRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, {
    data: { name: 'Chips', price: 5, quantity: 1 },
  });
  const item = await itemRes.json();
  return { billId: bill.id, itemId: item.id };
}

test('a joiner can unclaim an item they claimed, making it claimable again', async ({ page, context, request }) => {
  const code = await goLive(page);
  await seedBillWithItem(request, code);

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Dana');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  await joinerPage.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(joinerPage.getByText('Claimed by Dana')).toBeVisible({ timeout: 10000 });

  const unclaimButton = joinerPage.getByRole('button', { name: 'Unclaim' });
  await expect(unclaimButton).toBeEnabled();
  await unclaimButton.click();

  await expect(joinerPage.getByText('Claimed by Dana')).not.toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByRole('button', { name: 'Claim', exact: true })).toBeVisible();

  await joinerPage.close();
});
