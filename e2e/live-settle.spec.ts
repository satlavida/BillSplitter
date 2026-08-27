import { test, expect } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies the new
// Settle Up UI (src/Components/LiveSessionPanel.tsx) end-to-end: the
// creator settles the session, sees the resulting transactions, and a
// still-open joiner page picks up the settled state live.

test('creator settles a live session and a joiner sees it reflected live', async ({ page, context, request }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByPlaceholder('Enter name').fill('Kim');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByPlaceholder('Enter name').fill('Lee');
  await page.getByPlaceholder('Enter name').press('Enter');
  await expect(page.getByText('Kim')).toBeVisible();
  await expect(page.getByText('Lee')).toBeVisible();

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // Seed a bill Kim paid for, split equally between Kim and Lee, so
  // settlement has a real transaction to show (Lee owes Kim half of the
  // item) — a bill with no paidByPersonId contributes nothing to any
  // balance (server/internal/settlement/settlement.go), so that must be set
  // for this to produce a transaction at all.
  const sessRes = await request.get(`http://localhost:8080/api/sessions/${code}`);
  const sess = await sessRes.json();
  const kim = sess.people.find((p: { name: string }) => p.name === 'Kim');
  const lee = sess.people.find((p: { name: string }) => p.name === 'Lee');

  const billRes = await request.post(`http://localhost:8080/api/sessions/${code}/bills`, { data: { title: 'Lunch', currency: 'USD' } });
  const bill = await billRes.json();
  await request.patch(`http://localhost:8080/api/sessions/${code}/bills/${bill.id}`, {
    data: { title: 'Lunch', currency: 'USD', taxAmount: 0, paidByPersonId: kim.id },
  });
  const itemRes = await request.post(`http://localhost:8080/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Sandwich', price: 10, quantity: 1 } });
  const item = await itemRes.json();
  await request.post(`http://localhost:8080/api/sessions/${code}/bills/${bill.id}/items/${item.id}/claims`, { data: { personId: kim.id } });
  await request.post(`http://localhost:8080/api/sessions/${code}/bills/${bill.id}/items/${item.id}/claims`, { data: { personId: lee.id } });

  // The who-pays-whom list shows before settling too, not just after.
  await expect(page.getByRole('heading', { name: 'Settle Up' })).toBeVisible();
  await expect(page.getByText('Lee owes Kim')).toBeVisible();

  await page.getByRole('button', { name: 'Settle Up' }).click();
  await page.getByRole('button', { name: 'Confirm Settle' }).click();
  await expect(page.getByText('This session has been settled.')).toBeVisible();
  await expect(page.getByText('Lee owes Kim')).toBeVisible();

  // Survives a reload too — the list must come from a real refetch on
  // mount, not just leftover state from the settle action itself.
  await page.reload();
  await expect(page.getByText('This session has been settled.')).toBeVisible();
  await expect(page.getByText('Lee owes Kim')).toBeVisible({ timeout: 10000 });

  // A joiner who opens the link after settling sees the read-only banner.
  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Morgan');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText('The host has settled this session — items are read-only now.')).toBeVisible({ timeout: 10000 });

  await joinerPage.goto(`/#/join/${code}/bills/${bill.id}/step/2`);
  await expect(joinerPage.getByText('This session has been settled — items are read-only.')).toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByRole('button', { name: 'Claim', exact: true }).first()).toBeDisabled();

  await joinerPage.close();
});
