import { test, expect, type Page, type Browser } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies the
// Claim Approval page end-to-end: two joiners submit claims in
// claims_require_approval mode, the creator approves one and rejects the
// other, and both the joiners' own views and the activity log reflect it.

const LIVE_SERVER_URL = 'http://localhost:8080';

async function submitPendingClaim(browser: Browser, code: string, name: string, itemName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/#/join/${code}`);
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText("You're in!")).toBeVisible();

  const row = page.locator('li', { hasText: itemName });
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.getByRole('button', { name: 'Claim', exact: true }).click();
  await expect(row.getByText('Awaiting host approval…')).toBeVisible();

  return { page, context };
}

test('creator approves one pending claim and rejects another via the Claim Approval page', async ({ page, request }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Require approval (you approve each claim)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Dinner', currency: 'USD' } });
  const bill = await billRes.json();
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Pizza', price: 20, quantity: 1 } });
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Nachos', price: 10, quantity: 1 } });

  const { page: joinerA, context: contextA } = await submitPendingClaim(page.context().browser()!, code, 'Alice', 'Pizza');
  const { page: joinerB, context: contextB } = await submitPendingClaim(page.context().browser()!, code, 'Bob', 'Nachos');

  // The Pending claims link only appears in claims_require_approval mode.
  const pendingLink = page.getByRole('link', { name: 'Pending claims' });
  await expect(pendingLink).toBeVisible({ timeout: 10000 });
  await pendingLink.click();
  await page.waitForURL(`http://localhost:5173/#/session/${sessionId}/claims`);
  await expect(page.getByRole('heading', { name: 'Pending Claims' })).toBeVisible();

  const aliceRow = page.locator('li', { hasText: 'Alice' }).filter({ hasText: 'Pizza' });
  const bobRow = page.locator('li', { hasText: 'Bob' }).filter({ hasText: 'Nachos' });
  await expect(aliceRow).toBeVisible({ timeout: 10000 });
  await expect(bobRow).toBeVisible({ timeout: 10000 });

  await aliceRow.getByRole('button', { name: 'Approve' }).click();
  await expect(aliceRow).not.toBeVisible({ timeout: 10000 });

  await bobRow.getByRole('button', { name: 'Reject' }).click();
  await expect(bobRow).not.toBeVisible({ timeout: 10000 });

  await expect(page.getByText('No claims awaiting approval.')).toBeVisible({ timeout: 10000 });

  // Alice's own view now shows her claim as approved, not pending.
  const alicePizzaRow = joinerA.locator('li', { hasText: 'Pizza' });
  await expect(alicePizzaRow.getByText('Claimed by Alice')).toBeVisible({ timeout: 10000 });
  await expect(alicePizzaRow.getByText('Awaiting host approval…')).not.toBeVisible();

  // Bob's rejected claim reverts to a plain, re-claimable state.
  const bobNachosRow = joinerB.locator('li', { hasText: 'Nachos' });
  await expect(bobNachosRow.getByText('Awaiting host approval…')).not.toBeVisible({ timeout: 10000 });
  await expect(bobNachosRow.getByRole('button', { name: 'Claim', exact: true })).toBeEnabled();

  // Activity log: both submissions are logged as "claim" (recorded at
  // submission, not approval — see ClaimItem's doc comment), plus a
  // "reject" entry for Bob's declined claim. No entry exists for the
  // approve itself (ApproveClaim doesn't log activity).
  await page.goto(`/#/session/${sessionId}/activity`);
  await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
  await expect(page.getByText("Bob's claim on 1 part of Nachos was declined")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Alice claimed 1 part of Pizza')).toBeVisible({ timeout: 10000 });

  await joinerA.close();
  await contextA.close();
  await joinerB.close();
  await contextB.close();
});
