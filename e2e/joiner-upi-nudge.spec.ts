import { test, expect } from '@playwright/test';
import { goLive, joinAsNewPerson, closeAll, LIVE_SERVER_URL, getSessionSnapshot } from './helpers/liveSession';

// Covers Phase F's joiner-side UPI-ID touchpoint: a joiner who's owed money
// in settlement (someone else needs to pay them) sees a nudge to add their
// UPI ID, not at join-time or per-bill-visit. Once set, it's visible
// wherever a payer's UPI ID is shown (here: the joiner Bill Summary step).

test('a joiner owed money is nudged to add a UPI ID, then it shows up on the bill summary', async ({ page, browser, request }) => {
  const code = await goLive(page);

  const amy = await joinAsNewPerson(browser, code, 'Amy');
  const ben = await joinAsNewPerson(browser, code, 'Ben');

  const snapshot = await getSessionSnapshot(request, code);
  const amyId = snapshot.people.find((p: { name: string }) => p.name === 'Amy').id;
  const benId = snapshot.people.find((p: { name: string }) => p.name === 'Ben').id;

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Dinner', currency: 'USD' } });
  const bill = await billRes.json();
  await request.patch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}`, {
    data: { title: 'Dinner', currency: 'USD', taxAmount: 0, paidByPersonId: amyId },
  });
  const itemRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Pizza', price: 20, quantity: 1 } });
  const item = await itemRes.json();
  // Ben claims the whole item — he owes Amy (the payer), so Amy is owed money.
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items/${item.id}/claims`, { data: { personId: benId } });

  // Amy sees the nudge on her own session view (not Ben's — he owes, isn't owed).
  await amy.page.goto(`/#/join/${code}`);
  await expect(amy.page.getByText("You're owed money")).toBeVisible({ timeout: 10000 });
  await expect(ben.page.getByText("You're owed money")).not.toBeVisible();

  await amy.page.getByPlaceholder('name@bank').fill('amy@upi');
  await amy.page.getByRole('button', { name: 'Save' }).click();
  await expect(amy.page.getByText("You're owed money")).not.toBeVisible({ timeout: 10000 });

  // Now visible on the bill summary step, for both the payer's own view and
  // the other joiner's.
  await ben.page.goto(`/#/join/${code}/bills/${bill.id}/step/3`);
  await expect(ben.page.getByText('Pay via UPI:')).toBeVisible({ timeout: 10000 });
  await expect(ben.page.getByText('amy@upi')).toBeVisible();

  await closeAll(amy, ben);
});
