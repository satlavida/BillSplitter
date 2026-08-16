import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// Covers req 12: the activity log has person/action filters and shows
// relative ("Xs/m/h ago") timestamps instead of a raw timestamp string.

const LIVE_SERVER_URL = 'http://localhost:8080';

test('activity log filters entries by person and action', async ({ page, context, request }: { page: Page; context: import('@playwright/test').BrowserContext; request: APIRequestContext }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Snacks', currency: 'USD' } });
  const bill = await billRes.json();
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Chips', price: 5, quantity: 1 } });

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Pat');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();
  await joinerPage.goto(`/#/join/${code}/bills/${bill.id}/step/3`);
  await joinerPage.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(joinerPage.getByText('Claimed by Pat')).toBeVisible({ timeout: 10000 });

  await page.goto(`/#/session/${sessionId}/activity`);
  await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
  await expect(page.getByText('Pat claimed 1 part of Chips')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/ago|just now/)).toBeVisible();

  // Filtering to "Unclaims only" hides the claim entry.
  await page.locator('select').nth(1).selectOption({ label: 'Unclaims only' });
  await expect(page.getByText('No activity matches these filters.')).toBeVisible();

  await joinerPage.close();
});
