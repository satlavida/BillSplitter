import { test, expect } from '@playwright/test';
import { goLive, joinAsNewPerson, seedBill, LIVE_SERVER_URL, closeAll } from './helpers/liveSession';

// Covers the joiner-side "Things to Take Care of" signals in
// JoinerBillList.tsx: a "New" badge for a bill the joiner hasn't opened yet
// (localStorage-only, joinerVisitTracking.ts), and — once visited — a
// lighter "N still unclaimed for you" note computed from live data
// (joinerUnclaimedItems.ts), not shown together.

test('a joiner sees an unvisited badge before opening a bill, then an unclaimed-items note after', async ({ page, browser, request }) => {
  const code = await goLive(page);
  const { billId } = await seedBill(request, code, 'Dinner');
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items`, {
    data: { name: 'Pizza', price: 20, quantity: 1, splitType: 'equal' },
  });

  const joiner = await joinAsNewPerson(browser, code, 'Nina');

  // Before ever opening the bill: badged "New", no unclaimed-items note yet
  // (that only shows once visited).
  await expect(joiner.page.getByText('New')).toBeVisible();
  await expect(joiner.page.getByText(/still unclaimed for you/)).not.toBeVisible();

  // Visit the bill without claiming anything, then come back to the list.
  await joiner.page.getByText('Dinner', { exact: true }).click();
  await expect(joiner.page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();
  await joiner.page.goto(`/#/join/${code}`);

  await expect(joiner.page.getByText('New')).not.toBeVisible();
  await expect(joiner.page.getByText(/1 item still unclaimed for you/)).toBeVisible();

  await closeAll(joiner);
});
