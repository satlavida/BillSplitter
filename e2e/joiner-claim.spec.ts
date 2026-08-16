import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

// These run against the real Go backend (server/), started alongside the
// Vite dev server via playwright.config.ts's webServer array. Bills/items
// are added locally-only in this offline-first app (nothing in the UI
// pushes them live yet — that's a separate pending item), so a bill/item is
// seeded directly against the live server's own API here, the same way the
// Go integration tests do, to exercise the actual claiming UI end-to-end.

const LIVE_SERVER_URL = 'http://localhost:8080';

async function goLive(page: Page, joinModeLabel: string, permissionModeLabel: string): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: joinModeLabel });
  await page.locator('select').nth(1).selectOption({ label: permissionModeLabel });
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

test('open_link + edit: a new-name joiner claims an item and it shows up immediately, no approval step', async ({
  page,
  context,
  request,
}: {
  page: Page;
  context: BrowserContext;
  request: APIRequestContext;
}) => {
  const code = await goLive(page, 'Open link (anyone with the link joins instantly)', 'Edit (joiners can add and claim items directly)');
  const { billId } = await seedBillWithItem(request, code);

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Dana');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! Add items or claim what's yours.")).toBeVisible();

  // Step 3: Assign — where a joiner claims their own share (req 4).
  await joinerPage.goto(`/#/join/${code}/bills/${billId}/step/3`);
  await expect(joinerPage.getByText('Chips')).toBeVisible();
  await joinerPage.getByRole('button', { name: 'Claim', exact: true }).click();

  // Takes effect immediately — no pending/awaiting-approval state (req 6).
  await expect(joinerPage.getByText('Claimed by Dana')).toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByRole('button', { name: 'Unclaim' })).toBeEnabled();

  await joinerPage.close();
});
