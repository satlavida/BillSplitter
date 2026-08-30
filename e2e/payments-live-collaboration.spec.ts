import { test, expect } from '@playwright/test';
import { goLive, joinAsNewPerson, seedBill, seedItem, getSessionSnapshot, closeAll, LIVE_SERVER_URL } from './helpers/liveSession';

// Covers the Payments feature's live-collaboration path end to end (see
// architecture/payments.md): a joiner who owes money logs a cash payment,
// the payee (a different joiner) verifies it, settlement recalculates for
// everyone, the creator's settlement print summary reflects it, and an
// uninvolved third joiner never sees the payment record itself even though
// the aggregate balances are visible to all. A second test covers the
// "Require Payment Verification" toggle auto-verifying a payer-added
// payment immediately.

test('a joiner logs a payment, the payee verifies it, settlement updates for everyone, and an uninvolved joiner cannot see the payment record', async ({
  page,
  browser,
  request,
}) => {
  const code = await goLive(page);
  const sessionId = page.url().match(/#\/session\/([^/]+)$/)![1];

  const bob = await joinAsNewPerson(browser, code, 'Bob');
  const carol = await joinAsNewPerson(browser, code, 'Carol');

  const snapshot = await getSessionSnapshot(request, code);
  const bobId = snapshot.people.find((p: { name: string }) => p.name === 'Bob').id;
  const carolId = snapshot.people.find((p: { name: string }) => p.name === 'Carol').id;

  // Bob paid for a $100 coffee split equally with Carol -> Carol owes Bob $50.
  const { billId } = await seedBill(request, code, 'Coffee');
  await request.patch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}`, {
    data: { title: 'Coffee', currency: 'USD', taxAmount: 0, paidByPersonId: bobId },
  });
  const { itemId } = await seedItem(request, code, billId, { name: 'Coffee', price: 100 });
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, { data: { personId: bobId } });
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, { data: { personId: carolId } });

  // Carol logs a cash payment against what she owes Bob, using the
  // pre-filled "Log Payment" shortcut next to her outstanding transaction.
  await carol.page.goto(`/#/join/${code}`);
  const carolPayments = carol.page.getByTestId('joiner-payments-section');
  await expect(carolPayments.getByText(/You owe Bob 50\.00 USD/)).toBeVisible({ timeout: 10000 });
  await carolPayments.locator('li', { hasText: 'You owe Bob' }).getByRole('button', { name: 'Log Payment' }).click();

  await expect(carol.page.getByRole('heading', { name: 'Log a Payment' })).toBeVisible();
  await carolPayments.getByRole('button', { name: 'Log Payment', exact: true }).last().click();

  // Payer-added, verification required (the default) -> starts pending;
  // Carol (the payer) has no way to verify her own payment.
  await expect(carolPayments.getByText('Pending')).toBeVisible({ timeout: 10000 });
  await expect(carolPayments.getByRole('button', { name: 'Mark Received' })).not.toBeVisible();

  // Bob (the payee) sees it pending and confirms it.
  const bobPayments = bob.page.getByTestId('joiner-payments-section');
  await expect(bobPayments.getByText('Pending')).toBeVisible({ timeout: 15000 });
  await bobPayments.getByRole('button', { name: 'Mark Received' }).click();
  await expect(bobPayments.getByText('Verified')).toBeVisible({ timeout: 10000 });

  // Carol's own view picks up the verification too.
  await expect(carolPayments.getByText('Verified')).toBeVisible({ timeout: 15000 });

  // Settlement is now fully reconciled for the creator.
  await page.goto(`/#/session/${sessionId}/settlement`);
  await expect(page.getByText('Everyone is settled up.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Carol paid Bob \$50\.00 \(Cash\)/)).toBeVisible();
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();

  // An uninvolved third joiner (checked at the API level — the server's
  // GetSession filtering, not client-side hiding — see
  // architecture/payments.md's filterPaymentsForViewer) never sees the
  // payment record, even though Bob/Carol (parties to it) do.
  const daveJoinRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/join`, { data: { name: 'Dave' } });
  const dave = await daveJoinRes.json();
  const daveSessionRes = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}?personId=${dave.personId}`, {
    headers: { 'X-Joiner-Token': dave.token },
  });
  const daveSession = await daveSessionRes.json();
  expect(daveSession.payments).toHaveLength(0);

  const carolToken = await carol.page.evaluate((c) => localStorage.getItem('billsplitter-joiner-token:' + c), code);
  const carolSessionRes = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}?personId=${carolId}`, {
    headers: { 'X-Joiner-Token': carolToken ?? '' },
  });
  const carolSession = await carolSessionRes.json();
  expect(carolSession.payments).toHaveLength(1);

  await closeAll(bob, carol);
});

test('turning off Require Payment Verification auto-verifies a payer-added payment immediately', async ({ page, browser, request }) => {
  const code = await goLive(page);

  await page.getByRole('button', { name: 'Session Settings' }).click();
  await page.getByRole('checkbox', { name: 'Require Payment Verification' }).uncheck();
  // Scoped to the Modal component's own close-X (aria-label="Close") rather
  // than getByRole('button', {name: 'Close'}) — this app can have other
  // "Close" buttons on screen (sidebar, prompts) whose plain text content
  // also resolves to the accessible name "Close", causing a strict-mode
  // ambiguity that only the Modal's own instance is open at a time avoids.
  await page.locator('button[aria-label="Close"]').click();

  const bob = await joinAsNewPerson(browser, code, 'Bob');
  const carol = await joinAsNewPerson(browser, code, 'Carol');

  const snapshot = await getSessionSnapshot(request, code);
  const bobId = snapshot.people.find((p: { name: string }) => p.name === 'Bob').id;
  const carolId = snapshot.people.find((p: { name: string }) => p.name === 'Carol').id;

  // Carol paid for a $20 snack that only Bob consumed -> Bob owes Carol $20.
  const { billId } = await seedBill(request, code, 'Snacks');
  await request.patch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}`, {
    data: { title: 'Snacks', currency: 'USD', taxAmount: 0, paidByPersonId: carolId },
  });
  const { itemId } = await seedItem(request, code, billId, { name: 'Snacks', price: 20 });
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${billId}/items/${itemId}/claims`, { data: { personId: bobId } });

  await bob.page.goto(`/#/join/${code}`);
  const bobPayments = bob.page.getByTestId('joiner-payments-section');
  await expect(bobPayments.getByText(/You owe Carol 20\.00 USD/)).toBeVisible({ timeout: 10000 });
  await bobPayments.locator('li', { hasText: 'You owe Carol' }).getByRole('button', { name: 'Log Payment' }).click();

  await expect(bob.page.getByRole('heading', { name: 'Log a Payment' })).toBeVisible();
  await bobPayments.getByRole('button', { name: 'Log Payment', exact: true }).last().click();

  // Bob is the payer, not the payee, but verification is off -> auto-verified.
  await expect(bobPayments.getByText('Verified')).toBeVisible({ timeout: 10000 });
  await expect(bobPayments.getByText('Pending')).not.toBeVisible();

  await closeAll(bob, carol);
});
