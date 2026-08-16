import { test, expect } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. The UI never
// offers a way to claim on someone else's behalf, so this exercises the
// server's enforcement directly via the API, the same way the Go
// integration tests do (see server/internal/api/joiner_activity_test.go).

const LIVE_SERVER_URL = 'http://localhost:8080';

test('a joiner cannot claim an item on behalf of another person', async ({ request }) => {
  const createRes = await request.post(`${LIVE_SERVER_URL}/api/sessions`, {
    data: {
      title: 'Trip',
      people: [{ id: 'alice', name: 'Alice' }],
      joinMode: 'open_link',
      claimMode: 'free_select',
    },
  });
  const created = await createRes.json();

  const joinRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${created.code}/join`, { data: { name: 'Bob' } });
  const joiner = await joinRes.json();
  expect(joiner.status).toBe('approved');
  expect(joiner.token).toBeTruthy();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${created.code}/bills`, { data: { title: 'Dinner', currency: 'USD' } });
  const bill = await billRes.json();
  const itemRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${created.code}/bills/${bill.id}/items`, {
    data: { name: 'Pizza', price: 20, quantity: 1 },
  });
  const item = await itemRes.json();

  // Bob's token authenticates a claim for himself.
  const selfClaim = await request.post(`${LIVE_SERVER_URL}/api/sessions/${created.code}/bills/${bill.id}/items/${item.id}/claims`, {
    headers: { 'X-Joiner-Token': joiner.token },
    data: { personId: joiner.personId },
  });
  expect(selfClaim.status()).toBe(200);

  // Bob's token does NOT authenticate a claim on Alice's behalf.
  const otherClaim = await request.post(`${LIVE_SERVER_URL}/api/sessions/${created.code}/bills/${bill.id}/items/${item.id}/claims`, {
    headers: { 'X-Joiner-Token': joiner.token },
    data: { personId: 'alice' },
  });
  expect(otherClaim.status()).toBe(403);

  // Bob's token also can't unclaim on Alice's behalf.
  const otherUnclaim = await request.delete(`${LIVE_SERVER_URL}/api/sessions/${created.code}/bills/${bill.id}/items/${item.id}/claims/alice`, {
    headers: { 'X-Joiner-Token': joiner.token },
  });
  expect(otherUnclaim.status()).toBe(403);

  // No token at all is rejected on unclaim.
  const noTokenUnclaim = await request.delete(
    `${LIVE_SERVER_URL}/api/sessions/${created.code}/bills/${bill.id}/items/${item.id}/claims/${joiner.personId}`
  );
  expect(noTokenUnclaim.status()).toBe(401);
});
