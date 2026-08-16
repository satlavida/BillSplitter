import { test, expect, type Page } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies two
// bills in the same live session stay independent (a claim on one bill's
// item never leaks onto the other bill's item) and that the settlement
// endpoint correctly nets balances across both bills combined.

const LIVE_SERVER_URL = 'http://localhost:8080';

async function goLive(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Free select (joiners claim items directly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  return page.locator('span.font-mono.font-semibold').first().innerText();
}

test('two bills in a live session stay independent, and settlement nets balances across both', async ({ page, browser, request }) => {
  const code = await goLive(page);

  const bill1Res = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Groceries', currency: 'USD' } });
  const bill1 = await bill1Res.json();
  const item1Res = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill1.id}/items`, { data: { name: 'Bread', price: 10, quantity: 1 } });
  const item1 = await item1Res.json();

  const bill2Res = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Movie Night', currency: 'USD' } });
  const bill2 = await bill2Res.json();
  const item2Res = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill2.id}/items`, { data: { name: 'Tickets', price: 20, quantity: 1 } });
  const item2 = await item2Res.json();

  // Dana joins and pays for Groceries; Eli joins and pays for Movie Night —
  // but each CONSUMES the other's bill, so the settlement has a real net
  // balance to compute across the two bills combined. Separate browser
  // contexts: joinerStorage.ts keys the stored joiner id purely by session
  // code, so two joiner pages sharing one context would collide (see
  // joiner-fraction-stepper.spec.ts, which hit this).
  const danaContext = await browser.newContext();
  const danaPage = await danaContext.newPage();
  await danaPage.goto(`/#/join/${code}`);
  await danaPage.getByPlaceholder('Enter your name').fill('Dana');
  await danaPage.getByRole('button', { name: 'Join' }).click();
  await expect(danaPage.getByText("You're in!")).toBeVisible();

  const eliContext = await browser.newContext();
  const eliPage = await eliContext.newPage();
  await eliPage.goto(`/#/join/${code}`);
  await eliPage.getByPlaceholder('Enter your name').fill('Eli');
  await eliPage.getByRole('button', { name: 'Join' }).click();
  await expect(eliPage.getByText("You're in!")).toBeVisible();

  const sess = await (await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}`)).json();
  const dana = sess.people.find((p: { name: string }) => p.name === 'Dana');
  const eli = sess.people.find((p: { name: string }) => p.name === 'Eli');

  await request.patch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill1.id}`, {
    data: { title: 'Groceries', currency: 'USD', taxAmount: 0, paidByPersonId: dana.id },
  });
  await request.patch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill2.id}`, {
    data: { title: 'Movie Night', currency: 'USD', taxAmount: 0, paidByPersonId: eli.id },
  });

  // Cross-consumption: Eli claims Dana's Bread, Dana claims Eli's Tickets.
  const eliBreadRow = eliPage.locator('li', { hasText: 'Bread' });
  await expect(eliBreadRow).toBeVisible({ timeout: 10000 });
  await eliBreadRow.getByRole('button', { name: 'Claim', exact: true }).click();

  const danaTicketsRow = danaPage.locator('li', { hasText: 'Tickets' });
  await expect(danaTicketsRow).toBeVisible({ timeout: 10000 });
  await danaTicketsRow.getByRole('button', { name: 'Claim', exact: true }).click();

  // No cross-bill leakage: on Dana's own page, Bread (which she did NOT
  // claim) shows Eli, not her; Tickets (which she DID claim) shows her.
  const danaBreadCard = danaPage.locator('div.rounded-xl.shadow-sm', { hasText: 'Groceries' });
  await expect(danaBreadCard).toContainText('Claimed by Eli', { timeout: 10000 });
  await expect(danaBreadCard).not.toContainText('Claimed by Dana');

  const danaTicketsCard = danaPage.locator('div.rounded-xl.shadow-sm', { hasText: 'Movie Night' });
  await expect(danaTicketsCard).toContainText('Claimed by Dana', { timeout: 10000 });
  await expect(danaTicketsCard).not.toContainText('Claimed by Eli');

  // Creator's session home (never navigated away from) reflects both bills,
  // via LiveSessionPanel's own live-sync subscription.
  await expect(page.getByText('Groceries')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Movie Night')).toBeVisible({ timeout: 10000 });

  // Settlement nets the two bills into a single balance/transaction: Dana
  // paid 10 for Groceries (which Eli consumed) and owes 20 for Tickets
  // (which Eli paid for) — net, Dana owes Eli 10.
  await expect
    .poll(
      async () => {
        const settlement = await (await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}/settlement`)).json();
        const danaBalance = settlement.balances.find((b: { personId: string }) => b.personId === dana.id)?.amount;
        return danaBalance;
      },
      { timeout: 10000 }
    )
    .toBeCloseTo(-10, 2);

  const settlement = await (await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}/settlement`)).json();
  const eliBalance = settlement.balances.find((b: { personId: string }) => b.personId === eli.id)?.amount;
  expect(eliBalance).toBeCloseTo(10, 2);
  expect(settlement.transactions).toHaveLength(1);
  expect(settlement.transactions[0]).toMatchObject({ from: dana.id, to: eli.id });
  expect(settlement.transactions[0].amount).toBeCloseTo(10, 2);

  await danaPage.close();
  await danaContext.close();
  await eliPage.close();
  await eliContext.close();
});
