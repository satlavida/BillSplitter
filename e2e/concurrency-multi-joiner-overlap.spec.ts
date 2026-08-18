import { test, expect } from '@playwright/test';
import { goLive, joinAsNewPerson, seedBill, seedItem, getSessionSnapshot, closeAll } from './helpers/liveSession';

// Extends creator-sees-multiple-claimers.spec.ts's sequential multi-joiner
// coverage into true concurrency: three separate browser contexts (separate
// network requests, no shared client-side gating) firing claims/unclaims
// via Promise.all instead of one at a time. Each (item, personId) pair is a
// distinct row server-side (item_allocations table, store.go), so
// different-person concurrent writes should never conflict — this is the
// "safe" counterpart to concurrency-last-write-wins.spec.ts, which targets
// same-person concurrent writes instead.

test('three joiners claiming and unclaiming concurrently converge to the correct final member set', async ({ page, browser, request }) => {
  const code = await goLive(page);
  const sessionId = page.url().match(/#\/session\/([^/]+)$/)![1];
  const { billId } = await seedBill(request, code, 'Trip');
  const { itemId } = await seedItem(request, code, billId, { name: 'Cabin', price: 300 });

  await expect(page.getByText('Trip')).toBeVisible({ timeout: 10000 });
  await page.goto(`/#/session/${sessionId}/bill/${billId}/step/3`);
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
  const cabinCard = page.locator('div.rounded-xl.shadow-sm', { hasText: 'Cabin' });

  const alice = await joinAsNewPerson(browser, code, 'Alice');
  const bob = await joinAsNewPerson(browser, code, 'Bob');
  const carol = await joinAsNewPerson(browser, code, 'Carol');
  for (const joiner of [alice, bob, carol]) {
    await joiner.page.goto(`/#/join/${code}/bills/${billId}/step/3`);
    await expect(joiner.page.getByText('Cabin', { exact: true })).toBeVisible({ timeout: 10000 });
  }

  const consumedByCount = async () => {
    const snapshot = await getSessionSnapshot(request, code);
    const bill = snapshot.bills.find((b: { id: string }) => b.id === billId);
    const item = bill.items.find((i: { id: string }) => i.id === itemId);
    return item.consumedBy.length as number;
  };

  await Promise.all([alice, bob, carol].map((j) => j.page.getByRole('button', { name: 'Claim', exact: true }).click()));

  await expect.poll(consumedByCount, { timeout: 10000 }).toBe(3);
  await expect(cabinCard).toContainText('Alice', { timeout: 10000 });
  await expect(cabinCard).toContainText('Bob', { timeout: 10000 });
  await expect(cabinCard).toContainText('Carol', { timeout: 10000 });

  // Second overlapping wave: Bob and Carol unclaim at the same instant,
  // leaving only Alice.
  await Promise.all([
    bob.page.getByRole('button', { name: 'Unclaim', exact: true }).click(),
    carol.page.getByRole('button', { name: 'Unclaim', exact: true }).click(),
  ]);

  await expect.poll(consumedByCount, { timeout: 10000 }).toBe(1);
  await expect(cabinCard).toContainText('Alice', { timeout: 10000 });

  await closeAll(alice, bob, carol);
});
