import { test, expect, type APIRequestContext } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies the
// server-side half of receipt image sync end-to-end: an uploaded image's
// refKey/width/height round-trip onto GET /api/sessions/{code}'s bill, and
// a joiner's JoinPage renders it via GET /api/images/{refKey}.
//
// The client-side push (sessionStore.ts's pushReceiptImageLive, triggered
// when ScanReceiptButton.tsx sets Bill.receiptImage) isn't exercised here —
// it would require driving the real OpenRouter-backed POST /api/scan (see
// server/internal/api/scan_handlers.go) or a test-only store hook. It's
// covered by typecheck (LiveBillSchema/liveApi.ts wiring) and mirrors the
// same dynamic-import push pattern already e2e-tested for bill/item
// creation and edits.

const LIVE_SERVER_URL = 'http://localhost:8080';

test('a receipt image uploaded to a live bill is visible to a joiner', async ({ page, context, request }: { page: import('@playwright/test').Page; context: import('@playwright/test').BrowserContext; request: APIRequestContext }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Dinner', currency: 'USD' } });
  const bill = await billRes.json();

  const uploadRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/images`, {
    multipart: {
      image: { name: 'receipt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-jpeg-bytes') },
      width: '100',
      height: '150',
    },
  });
  expect(uploadRes.status()).toBe(201);
  const { refKey } = await uploadRes.json();
  expect(refKey).toBeTruthy();

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Jo');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! Add items or claim what's yours.")).toBeVisible();

  const img = joinerPage.getByAltText('Receipt');
  await expect(img).toBeVisible({ timeout: 10000 });
  await expect(img).toHaveAttribute('src', `${LIVE_SERVER_URL}/api/images/${refKey}`);

  await joinerPage.close();
});
