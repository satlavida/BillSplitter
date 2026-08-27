import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array.

const LIVE_SERVER_URL = 'http://localhost:8080';

async function goLive(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Edit (joiners can add and claim items directly)' });
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

test('the creator sees a joiner claim and unclaim in the activity log', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  const code = await goLive(page);
  const { billId } = await seedBillWithItem(page.request, code);

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Dana');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  await joinerPage.goto(`/#/join/${code}/bills/${billId}/step/2`);
  await joinerPage.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(joinerPage.getByText('Claimed by Dana')).toBeVisible({ timeout: 10000 });
  await joinerPage.getByRole('button', { name: 'Unclaim' }).click();
  await expect(joinerPage.getByText('Claimed by Dana')).not.toBeVisible({ timeout: 10000 });

  await page.getByRole('link', { name: 'Activity log' }).click();
  await page.waitForURL(`http://localhost:5173/#/session/${sessionId}/activity`);
  await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();

  // Scoped to the activity log's own list — the same line can also appear
  // as a toast notification (LiveSessionPanel.tsx's toastLatestActivity) and
  // in the desktop right panel's ActivityFeedMini, which would otherwise
  // make this a strict-mode ambiguous match.
  const logList = page.getByTestId('activity-log-list');
  await expect(logList.getByText('Dana claimed 1 part of Chips')).toBeVisible({ timeout: 10000 });
  await expect(logList.getByText('Dana unclaimed 1 part of Chips')).toBeVisible({ timeout: 10000 });

  await joinerPage.close();
});
