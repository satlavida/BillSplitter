import { test, expect, type Page, type Browser, type BrowserContext, type APIRequestContext } from '@playwright/test';

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

// quantity: 3 "parts" — two joiners will together claim exactly 3 to flip
// the creator's correctness indicator from incorrect to correct.
async function seedFractionItem(request: APIRequestContext, code: string): Promise<{ billId: string; itemId: string }> {
  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Pizza Night', currency: 'USD' } });
  const bill = await billRes.json();
  const itemRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, {
    data: { name: 'Pizza', price: 24, quantity: 3, splitType: 'fraction' },
  });
  const item = await itemRes.json();
  return { billId: bill.id, itemId: item.id };
}

test('two joiners pick their own Quantity Split shares and the totals sum correctly', async ({ page, context, request, browser }: { page: Page; context: BrowserContext; request: APIRequestContext; browser: Browser }) => {
  const code = await goLive(page);
  const { billId } = await seedFractionItem(request, code);

  const joinerA = await context.newPage();
  await joinerA.goto(`/#/join/${code}`);
  await joinerA.getByPlaceholder('Enter your name').fill('Alice');
  await joinerA.getByRole('button', { name: 'Join' }).click();
  await expect(joinerA.getByText("You're in!")).toBeVisible();
  await joinerA.goto(`/#/join/${code}/bills/${billId}/step/3`);

  // joinerB needs its own browser context, not just a new page in the
  // creator's/joinerA's context — joinerStorage.ts keys the stored joiner
  // id purely by session code, so a second page sharing the same context
  // (and thus the same localStorage) would auto-restore as Alice instead
  // of showing the join form, exactly like two tabs in one real browser.
  const joinerBContext = await browser.newContext();
  const joinerB = await joinerBContext.newPage();
  await joinerB.goto(`/#/join/${code}`);
  await joinerB.getByPlaceholder('Enter your name').fill('Bob');
  await joinerB.getByRole('button', { name: 'Join' }).click();
  await expect(joinerB.getByText("You're in!")).toBeVisible();
  await joinerB.goto(`/#/join/${code}/bills/${billId}/step/3`);

  // Alice claims 2 slices via the quantity-picker modal.
  await expect(joinerA.getByText('Pizza', { exact: true })).toBeVisible();
  await joinerA.getByRole('button', { name: 'Claim', exact: true }).click();
  await joinerA.getByRole('button', { name: '2', exact: true }).click();

  // Bob claims 1 slice.
  await joinerB.getByRole('button', { name: 'Claim', exact: true }).click();
  await joinerB.getByRole('button', { name: '1', exact: true }).click();

  // Server-side total across both joiners is now 3, matching quantity.
  await expect
    .poll(
      async () => {
        const res = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}`);
        const sess = await res.json();
        const item = sess.bills[0].items[0];
        return item.consumedBy.reduce((sum: number, c: { value: number }) => sum + c.value, 0);
      },
      { timeout: 10000 }
    )
    .toBe(3);

  await joinerA.close();
  await joinerB.close();
  await joinerBContext.close();
});
