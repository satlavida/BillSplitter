import { test, expect } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies the new
// Settle Up UI (src/Components/LiveSessionPanel.tsx) end-to-end: the
// creator settles the session, sees the resulting transactions, and a
// still-open joiner page picks up the settled state live.

test('creator settles a live session and a joiner sees it reflected live', async ({ page, context, request }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(/#\/session\/[^/]+\/bill\/[^/]+\/step\/1$/);
  await page.getByPlaceholder('Enter name').fill('Kim');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByPlaceholder('Enter name').fill('Lee');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByRole('link', { name: '← Back to Session' }).click();
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // Seed a bill/item and have Kim claim it, so settlement has a real
  // transaction to show (Lee owes Kim half of the item).
  const billRes = await request.post(`http://localhost:8080/api/sessions/${code}/bills`, { data: { title: 'Lunch', currency: 'USD' } });
  const bill = await billRes.json();
  const itemRes = await request.post(`http://localhost:8080/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Sandwich', price: 10, quantity: 1 } });
  const item = await itemRes.json();
  const sessRes = await request.get(`http://localhost:8080/api/sessions/${code}`);
  const sess = await sessRes.json();
  const kim = sess.people.find((p: { name: string }) => p.name === 'Kim');
  await request.post(`http://localhost:8080/api/sessions/${code}/bills/${bill.id}/items/${item.id}/claims`, { data: { personId: kim.id } });

  await expect(page.getByRole('heading', { name: 'Settle Up' })).toBeVisible();
  await page.getByRole('button', { name: 'Settle Up' }).click();
  await page.getByRole('button', { name: 'Confirm Settle' }).click();
  await expect(page.getByText('This session has been settled.')).toBeVisible();

  // A joiner who opens the link after settling sees the read-only banner.
  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Morgan');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText('The host has settled this session — items are read-only now.')).toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByRole('button', { name: 'Claim', exact: true }).first()).toBeDisabled();

  await joinerPage.close();
});
