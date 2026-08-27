import { test, expect } from '@playwright/test';
import { goLive, joinAsNewPerson, seedBill, seedItem, getSessionSnapshot, closeAll } from './helpers/liveSession';

// Complements concurrency-rapid-claim-toggle.spec.ts's creator-side
// pendingLiveWrites regression by stressing the same "rapid edits must
// converge, not get stuck mid-sequence" property from the JOINER's side of
// a Quantity Split item, with the creator watching live the whole time
// (never navigating away, mirroring creator-sees-multiple-claimers.spec.ts).
// JoinerItemRow.tsx gates each claim behind a `busy` disabled state, so
// these clicks aren't truly overlapping network requests — but each one
// fires the instant the previous button re-enables, with no artificial
// wait inserted to let things "settle" first.

test("creator watching live sees a joiner's rapid re-claims on a Quantity Split item converge to the final value", async ({ page, browser, request }) => {
  const code = await goLive(page);
  const sessionId = page.url().match(/#\/session\/([^/]+)$/)![1];
  const { billId } = await seedBill(request, code, 'Pizza Night');
  const { itemId } = await seedItem(request, code, billId, { name: 'Pizza', price: 24, quantity: 5, splitType: 'fraction' });

  // The creator's local sessionStore only learns about a server-seeded bill
  // once LiveSessionPanel's poll/SSE sync merges it in — BillEditorPage.tsx
  // does a synchronous *local-only* lookup with no fallback fetch, so an
  // unknown billId would redirect away. Wait for the bill to show up in the
  // list (rendered straight off the merged session.bills) rather than
  // racing a fixed timeout before navigating to it.
  await expect(page.getByText('Pizza Night')).toBeVisible({ timeout: 10000 });
  await page.goto(`/#/session/${sessionId}/bill/${billId}/step/2`);
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
  const pizzaCard = page.locator('div.rounded-xl.shadow-sm', { hasText: 'Pizza' });

  const alice = await joinAsNewPerson(browser, code, 'Alice');
  await alice.page.goto(`/#/join/${code}/bills/${billId}/step/2`);
  await expect(alice.page.getByText('Pizza', { exact: true })).toBeVisible({ timeout: 10000 });

  // 1 -> 2 -> 3 -> 4, reopening the number-grid modal each time (there's no
  // +/- stepper — ClaimQuantityModal.tsx replaced it with a grid, and the
  // triggering button's accessible name flips between "Claim" and
  // "Claimed N" as the value changes).
  await alice.page.getByRole('button', { name: 'Claim', exact: true }).click();
  await alice.page.getByRole('button', { name: '1', exact: true }).click();
  await alice.page.getByRole('button', { name: 'Claimed 1', exact: true }).click();
  await alice.page.getByRole('button', { name: '2', exact: true }).click();
  await alice.page.getByRole('button', { name: 'Claimed 2', exact: true }).click();
  await alice.page.getByRole('button', { name: '3', exact: true }).click();
  await alice.page.getByRole('button', { name: 'Claimed 3', exact: true }).click();
  await alice.page.getByRole('button', { name: '4', exact: true }).click();

  await expect(pizzaCard).toContainText('Alice', { timeout: 10000 });

  const aliceClaimedValue = async () => {
    const snapshot = await getSessionSnapshot(request, code);
    const bill = snapshot.bills.find((b: { id: string }) => b.id === billId);
    const item = bill.items.find((i: { id: string }) => i.id === itemId);
    const alicePersonId = snapshot.people.find((p: { name: string }) => p.name === 'Alice')?.id;
    return item.consumedBy.find((c: { personId: string }) => c.personId === alicePersonId)?.value;
  };

  await expect.poll(aliceClaimedValue, { timeout: 10000 }).toBe(4);

  // Confirm the creator's view doesn't flicker back to an intermediate
  // value (1, 2, or 3) on a later refresh.
  await page.waitForTimeout(1500);
  expect(await aliceClaimedValue()).toBe(4);

  await closeAll(alice);
});
