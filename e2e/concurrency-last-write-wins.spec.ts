import { test, expect, type APIRequestContext } from '@playwright/test';
import { LIVE_SERVER_URL } from './helpers/liveSession';

// Documents a real gap rather than defending a fix: server/internal/store/
// store.go's ClaimItemFreeSelect does a plain
// `INSERT ... ON CONFLICT (item_id, person_id) DO UPDATE SET value =
// excluded.value` — no version/timestamp column, no optimistic-concurrency
// check. UnclaimItem is a plain DELETE. Two *different* people claiming the
// same item never conflict (separate rows, see
// concurrency-multi-joiner-overlap.spec.ts), but the exact same (item,
// person) pair being written concurrently from two sources resolves as
// whichever physical DB write lands last — no request-ordering guarantee,
// no rejection of a "stale" write. These tests exercise that gap at the API
// level (bypassing frontend guards like pendingLiveWrites entirely) and
// assert only that the result isn't corrupted, never a specific winner,
// since none is guaranteed by the code today. This is the concrete evidence
// behind "do we need a SAGA-style/versioned reconciliation system" — if a
// future change adds real ordering, tighten these assertions to something
// deterministic as part of that work.

async function seedSessionWithBobAndItem(request: APIRequestContext, quantity = 5) {
  // Person ids must be unique across the whole (shared, parallel-test) DB,
  // not just within one session — a hardcoded 'bob' across parallel workers
  // hits a UNIQUE constraint and POST /api/sessions 500s for every worker
  // but the first.
  const bobId = `bob-${test.info().workerIndex}-${Date.now()}`;

  const createRes = await request.post(`${LIVE_SERVER_URL}/api/sessions`, {
    data: { title: 'Trip', people: [{ id: bobId, name: 'Bob' }], joinMode: 'open_link' },
  });
  const created = await createRes.json();
  const code = created.code as string;

  const joinRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/join`, { data: { existingPersonId: bobId } });
  const joiner = await joinRes.json();
  const token = joiner.token as string;

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Cabin Trip', currency: 'USD' } });
  const bill = await billRes.json();
  const itemRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, {
    data: { name: 'Cabin', price: 300, quantity, splitType: 'fraction' },
  });
  const item = await itemRes.json();

  return { code, token, billId: bill.id as string, itemId: item.id as string, bobId };
}

async function getBobsClaimedValue(request: APIRequestContext, code: string, bobId: string) {
  const res = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}`);
  const snapshot = await res.json();
  return snapshot.bills[0].items[0].consumedBy.find((c: { personId: string }) => c.personId === bobId)?.value;
}

test('creator editing on behalf of a joiner races that joiner\'s own self-edit on the same allocation', async ({ request }) => {
  const { code, token, billId, itemId, bobId } = await seedSessionWithBobAndItem(request);

  // Creator's token-free "edit on behalf of" auth mode vs Bob's own
  // X-Joiner-Token self-edit, targeting the same (item, person) row.
  const [creatorRes, joinerRes] = await Promise.all([
    request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, { data: { personId: bobId, value: 2 } }),
    request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, {
      data: { personId: bobId, value: 5 },
      headers: { 'X-Joiner-Token': token },
    }),
  ]);

  expect(creatorRes.status()).toBeLessThan(500);
  expect(joinerRes.status()).toBeLessThan(500);

  const finalValue = await getBobsClaimedValue(request, code, bobId);
  expect([2, 5]).toContain(finalValue);
});

test("the same joiner's two tabs racing a claim update on the same allocation resolve to one valid value, not a corrupted one", async ({ request }) => {
  const { code, token, billId, itemId, bobId } = await seedSessionWithBobAndItem(request);

  const [res1, res2] = await Promise.all([
    request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, {
      data: { personId: bobId, value: 2 },
      headers: { 'X-Joiner-Token': token },
    }),
    request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, {
      data: { personId: bobId, value: 4 },
      headers: { 'X-Joiner-Token': token },
    }),
  ]);

  expect(res1.status()).toBeLessThan(500);
  expect(res2.status()).toBeLessThan(500);

  const finalValue = await getBobsClaimedValue(request, code, bobId);
  expect([2, 4]).toContain(finalValue);
});

test('an unclaim racing a concurrent re-claim on the same allocation resolves to exactly one outcome, no 5xx, no partial state', async ({ request }) => {
  const { code, token, billId, itemId, bobId } = await seedSessionWithBobAndItem(request);

  const initialClaim = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, {
    data: { personId: bobId, value: 1 },
    headers: { 'X-Joiner-Token': token },
  });
  expect(initialClaim.status()).toBeLessThan(300);

  const [delRes, postRes] = await Promise.all([
    request.delete(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims/${bobId}`, { headers: { 'X-Joiner-Token': token } }),
    request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, {
      data: { personId: bobId, value: 3 },
      headers: { 'X-Joiner-Token': token },
    }),
  ]);

  expect(delRes.status()).toBeLessThan(500);
  expect(postRes.status()).toBeLessThan(500);

  const finalValue = await getBobsClaimedValue(request, code, bobId);
  // Either the unclaim won (no allocation row -> undefined) or the re-claim
  // won (value 3). Both requests succeeded at the HTTP level regardless of
  // which one's effect actually survived — the server never rejects the
  // "loser," it just silently loses the race.
  expect(finalValue === undefined || finalValue === 3).toBe(true);
});
