import { test, expect, type Page, type Browser, type BrowserContext, type APIRequestContext } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies
// ItemAssignment.tsx's fraction-correctness badge — added for the joiner
// Quantity Split claim modal, never previously e2e-verified — actually
// renders and flips from a warning to "Split complete" as joiners claim
// shares, while the creator sits in the bill editor (relies on the
// live-refresh fix).

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

// quantity: 3 "parts" — two joiners will together claim exactly 3.
async function seedFractionItem(request: APIRequestContext, code: string): Promise<string> {
  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Pizza Night', currency: 'USD' } });
  const bill = await billRes.json();
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, {
    data: { name: 'Pizza', price: 24, quantity: 3, splitType: 'fraction' },
  });
  return bill.id;
}

async function joinAndClaimQuantity(browser: Browser, code: string, billId: string, name: string, quantity: number): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/#/join/${code}`);
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText("You're in!")).toBeVisible();
  await page.goto(`/#/join/${code}/bills/${billId}/step/2`);
  await expect(page.getByText('Pizza', { exact: true })).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: 'Claim', exact: true }).click();
  await page.getByRole('button', { name: String(quantity), exact: true }).click();
  return { page, context };
}

test("the creator's fraction-correctness badge flips to 'Split complete' as joiners claim shares, without navigating away", async ({
  page,
  browser,
  request,
}) => {
  const code = await goLive(page);
  const billId = await seedFractionItem(request, code);

  // Creator's session home already merges the API-seeded bill live — click
  // into it once it appears, rather than creating it through the UI (which
  // has no splitType control for a brand-new item). Scoped to the bill list
  // (data-testid="bill-list") since the item hasn't been claimed yet, so
  // the "Things to Take Care of" section also links to the same bill title.
  const billList = page.getByTestId('bill-list');
  await expect(billList.getByText('Pizza Night', { exact: true })).toBeVisible({ timeout: 10000 });
  await billList.getByText('Pizza Night', { exact: true }).click();
  await page.waitForURL(new RegExp(`#/session/[^/]+/bill/[^/]+/step/1$`));

  await page.getByRole('button', { name: 'Go to step 2: Assign' }).click();
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();

  const pizzaCard = page.locator('div.rounded-xl.shadow-sm', { hasText: 'Pizza' });
  await expect(pizzaCard.getByText(/Claimed parts total 0, item has 3/)).toBeVisible({ timeout: 10000 });

  const alice = await joinAndClaimQuantity(browser, code, billId, 'Alice', 2);
  await expect(pizzaCard.getByText(/Claimed parts total 2, item has 3/)).toBeVisible({ timeout: 10000 });

  const bob = await joinAndClaimQuantity(browser, code, billId, 'Bob', 1);
  await expect(pizzaCard.getByText('✓ Split complete')).toBeVisible({ timeout: 10000 });

  await alice.page.close();
  await alice.context.close();
  await bob.page.close();
  await bob.context.close();
});
