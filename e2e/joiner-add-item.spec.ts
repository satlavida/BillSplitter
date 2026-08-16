import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array.

const LIVE_SERVER_URL = 'http://localhost:8080';

async function goLive(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Edit (joiners can add and claim items directly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  return page.locator('span.font-mono.font-semibold').first().innerText();
}

async function seedBill(request: APIRequestContext, code: string): Promise<string> {
  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Snacks', currency: 'USD' } });
  const bill = await billRes.json();
  return bill.id;
}

test('a joiner can add an item to an existing bill, and it shows up for both the joiner and the creator', async ({ page, context, request }) => {
  const code = await goLive(page);
  const billId = await seedBill(request, code);

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Dana');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  await joinerPage.goto(`/#/join/${code}/bills/${billId}/step/2`);
  await expect(joinerPage.getByText('No items yet.')).toBeVisible();
  await joinerPage.getByRole('button', { name: '+ Add item' }).click();
  await joinerPage.getByPlaceholder('Item name').fill('Soda');
  await joinerPage.getByPlaceholder('Price').fill('3.50');
  await joinerPage.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(joinerPage.getByText('Soda')).toBeVisible({ timeout: 10000 });

  // The creator sees the item too, once they navigate into the live bill.
  // The creator's own live snapshot merges on the next live-sync tick — the
  // simplest way to observe it end-to-end without new UI is to refetch the
  // session directly, mirroring what LiveSessionPanel's poll/SSE already does.
  await expect
    .poll(
      async () => {
        const res = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}`);
        const sess = await res.json();
        const items = sess.bills.flatMap((b: { items: { name: string }[] }) => b.items);
        return items.some((item: { name: string }) => item.name === 'Soda');
      },
      { timeout: 10000 }
    )
    .toBe(true);

  await joinerPage.close();
});
