import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

// Runs directly against the real Go backend's API (server/) — the identity
// reclaim-lock (presence.Tracker.IsAvailable) has a 5-minute stale
// threshold, too long to exercise through the UI in an e2e run, so this
// drives the join endpoint directly the same way
// joiner-cannot-claim-others.spec.ts does. See
// server/internal/api/creator_identity_test.go for the equivalent Go
// integration test (including the "becomes available once stale" case,
// which needs to fake the clock and so isn't practical here either).

const LIVE_SERVER_URL = 'http://localhost:8080';

test('a second joiner cannot join as a person another joiner is actively using', async ({ request }: { request: APIRequestContext }) => {
  const createRes = await request.post(`${LIVE_SERVER_URL}/api/sessions`, {
    data: { title: 'Trip', people: [{ id: 'bob', name: 'Bob' }], joinMode: 'open_link' },
  });
  const created = await createRes.json();

  const firstJoin = await request.post(`${LIVE_SERVER_URL}/api/sessions/${created.code}/join`, { data: { existingPersonId: 'bob' } });
  expect(firstJoin.status()).toBe(201);

  const secondJoin = await request.post(`${LIVE_SERVER_URL}/api/sessions/${created.code}/join`, { data: { existingPersonId: 'bob' } });
  expect(secondJoin.status()).toBe(409);
});

test('a joiner UI surfaces the reclaim-lock error', async ({ page, context, browser }: { page: Page; context: BrowserContext; browser: import('@playwright/test').Browser }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(2).selectOption({ label: 'Add myself as a new person…' });
  await page.getByPlaceholder('Your name').fill('Jack');
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // A real (non-creator) person, joined by name, so a second joiner can try
  // to claim the same identity.
  const firstJoiner = await context.newPage();
  await firstJoiner.goto(`/#/join/${code}`);
  await firstJoiner.getByPlaceholder('Enter your name').fill('Karen');
  await firstJoiner.getByRole('button', { name: 'Join' }).click();
  await expect(firstJoiner.getByText("You're in!")).toBeVisible();

  // A separate browser context — sharing `context` would carry over Karen's
  // stored joiner token (see joinerStorage.ts), auto-resuming her session
  // instead of showing a fresh join form to try claiming her identity.
  const secondContext = await browser.newContext();
  const secondJoiner = await secondContext.newPage();
  await secondJoiner.goto(`/#/join/${code}`);
  await secondJoiner.locator('select').selectOption({ label: 'Karen' });
  await secondJoiner.getByRole('button', { name: 'Join' }).click();
  await expect(secondJoiner.getByText(/already active/i)).toBeVisible({ timeout: 10000 });

  await firstJoiner.close();
  await secondContext.close();
});
