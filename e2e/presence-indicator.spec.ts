import { test, expect, type Page, type Browser } from '@playwright/test';

// Runs against the real Go backend (server/). Covers req 3: a joiner's
// heartbeat (usePresenceHeartbeat.ts, every 500ms) drives an online/offline
// dot next to their linked person in the creator's PeopleSection, polling
// GET .../presence every 500ms (see presence.Tracker's 2s OnlineThreshold).

test('creator sees a joiner go online, then offline once their tab closes', async ({ page, browser }: { page: Page; browser: Browser }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // A separate browser context (not just a new tab) so the joiner's own
  // heartbeat loop keeps running independently of the creator's page.
  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Leo');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  // Creator's PeopleSection picks up the online dot for Leo.
  const leoRow = page.locator('li', { hasText: 'Leo' });
  await expect(leoRow.locator('[aria-label="Online"]')).toBeVisible({ timeout: 10000 });

  // Once the joiner's tab (and its heartbeat loop) is gone, the dot flips to
  // offline within a few seconds (2s OnlineThreshold + poll interval).
  await joinerContext.close();
  await expect(leoRow.locator('[aria-label="Offline"]')).toBeVisible({ timeout: 10000 });
});
