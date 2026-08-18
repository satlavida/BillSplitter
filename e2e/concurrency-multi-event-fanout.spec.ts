import { test, expect } from '@playwright/test';
import { goLive, joinAsNewPerson, closeAll } from './helpers/liveSession';

// Regression coverage for commit add401e (createStaleResponseGuard,
// src/lib/liveSync.ts): a single local edit can fan out into multiple
// server writes -> multiple SSE events -> multiple concurrent
// getLiveSession() refreshes that can resolve out of order. Selecting/
// deselecting several people on one item is exactly this fan-out —
// sessionStore.ts's syncConsumedByLive diffs consumedBy and pushes one
// independent claim/unclaim call per changed person, each broadcasting its
// own SSE event. Fired back-to-back with no awaited settle between clicks.

test('creator rapidly toggling multiple people fans out several SSE events, and a joiner watching converges on the final set without flickering', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  for (const name of ['Alice', 'Bob', 'Carol']) {
    await page.getByPlaceholder('Enter name').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }

  const code = await goLive(page);
  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(/\/bill\/[^/]+\/step\/1$/);
  const billId = page.url().match(/\/bill\/([^/]+)\/step\/1$/)![1];
  await page.getByRole('button', { name: 'Go to step 2: Items' }).click();
  await page.getByPlaceholder('e.g., Pizza').fill('Pizza');
  await page.getByPlaceholder('0.00').first().fill('30');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Go to step 3: Assign' }).click();
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();

  const pizzaCard = page.locator('div.rounded-xl.shadow-sm', { hasText: 'Pizza' });

  const dan = await joinAsNewPerson(browser, code, 'Dan');
  await dan.page.goto(`/#/join/${code}/bills/${billId}/step/3`);
  await expect(dan.page.getByText('Pizza', { exact: true })).toBeVisible({ timeout: 10000 });
  const danPizzaRow = dan.page.locator('li', { hasText: 'Pizza' });

  // Select Alice, Bob, Carol, then deselect Bob — four independent pushes,
  // four SSE events, fired without waiting for any of them to resolve.
  // Final expected membership: Alice + Carol, not Bob.
  await pizzaCard.getByRole('button', { name: 'Alice', exact: true }).click();
  await pizzaCard.getByRole('button', { name: 'Bob', exact: true }).click();
  await pizzaCard.getByRole('button', { name: 'Carol', exact: true }).click();
  await pizzaCard.getByRole('button', { name: 'Bob', exact: true }).click();

  // Scoped to the "Split between:" line specifically, not the whole card —
  // every person (including unselected ones) renders as a ToggleButton with
  // their name as its label, so checking the card's full text would always
  // find "Bob" regardless of whether he's actually selected.
  const splitBetweenLine = pizzaCard.locator('p', { hasText: 'Split between:' });
  const hasExpectedMembers = (text: string) => /Alice/.test(text) && !/Bob/.test(text) && /Carol/.test(text);

  await expect.poll(async () => hasExpectedMembers(await splitBetweenLine.innerText()), { timeout: 10000 }).toBe(true);
  await expect.poll(async () => hasExpectedMembers(await danPizzaRow.innerText()), { timeout: 10000 }).toBe(true);

  // Re-check after a short gap to catch a delayed flicker back to a stale
  // intermediate fan-out state (e.g. Bob still present, or Carol missing),
  // not just the first moment it happens to look right — an out-of-order
  // refresh applying late is exactly what the sequence-stamped guard exists
  // to prevent.
  await page.waitForTimeout(1500);
  expect(hasExpectedMembers(await splitBetweenLine.innerText())).toBe(true);
  expect(hasExpectedMembers(await danPizzaRow.innerText())).toBe(true);

  await closeAll(dan);
});
