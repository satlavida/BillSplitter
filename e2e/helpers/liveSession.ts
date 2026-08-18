import { expect, type Page, type Browser, type BrowserContext, type APIRequestContext } from '@playwright/test';

// Shared setup helpers for the concurrency-*.spec.ts files. This is the
// first shared e2e helper file — every other spec in e2e/ defines its own
// small local helpers inline, which is fine when a spec needs 1-2 of them,
// but the concurrency specs all need the same "go live, join N people, seed
// a bill/item" boilerplate, so duplicating it 5+ times crossed the line
// where extraction pays for itself. Keep this file thin: only the parts
// that are byte-for-byte identical across specs live here. Race
// orchestration (Promise.all timing) and assertions stay inline per spec,
// same as the rest of e2e/.

export const LIVE_SERVER_URL = 'http://localhost:8080';

export async function goLive(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Edit (joiners can add and claim items directly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  return page.locator('span.font-mono.font-semibold').first().innerText();
}

// Each joiner needs its own BrowserContext — joinerStorage.ts keys the
// stored joiner id purely by session code, so two pages sharing a context
// collide (see joiner-fraction-stepper.spec.ts).
export async function joinAsNewPerson(browser: Browser, code: string, name: string): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/#/join/${code}`);
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText("You're in!")).toBeVisible();
  return { page, context };
}

export async function seedBill(request: APIRequestContext, code: string, title: string): Promise<{ billId: string }> {
  const res = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title, currency: 'USD' } });
  const bill = await res.json();
  return { billId: bill.id };
}

export async function seedItem(
  request: APIRequestContext,
  code: string,
  billId: string,
  opts: { name: string; price: number; quantity?: number; splitType?: 'equal' | 'fraction' }
): Promise<{ itemId: string }> {
  const res = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items`, {
    data: { name: opts.name, price: opts.price, quantity: opts.quantity ?? 1, splitType: opts.splitType ?? 'equal' },
  });
  const item = await res.json();
  return { itemId: item.id };
}

export async function getSessionSnapshot(request: APIRequestContext, code: string) {
  const res = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}`);
  return res.json();
}

export async function closeAll(...actors: { page: Page; context: BrowserContext }[]): Promise<void> {
  for (const actor of actors) {
    await actor.page.close();
    await actor.context.close();
  }
}
