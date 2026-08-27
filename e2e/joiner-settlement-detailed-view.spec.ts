import { test, expect } from '@playwright/test';

// The joiner's "Your settlement" card gets the same Basic/Detailed toggle as
// the creator's settlement page (settlement-detailed-view.spec.ts):
// Detailed adds a per-bill line for just this joiner's own balance.

const LIVE_SERVER_URL = 'http://localhost:8080';

test('joiner Detailed toggle shows a per-bill line for their own balance', async ({ page, context, request }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByPlaceholder('Enter name').fill('Kim');
  await page.getByPlaceholder('Enter name').press('Enter');
  await expect(page.getByText('Kim')).toBeVisible();

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // Lee joins as a brand-new person (avoids the existing-person picker,
  // which is a native <select> the join page no longer renders — see
  // UIV3_27_08_2026log.md's "Known pre-existing issues" note).
  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Lee');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  const sessRes = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}`);
  const sess = await sessRes.json();
  const kim = sess.people.find((p: { name: string }) => p.name === 'Kim');
  const lee = sess.people.find((p: { name: string }) => p.name === 'Lee');

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Lunch', currency: 'USD' } });
  const bill = await billRes.json();
  await request.patch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}`, {
    data: { title: 'Lunch', currency: 'USD', taxAmount: 0, paidByPersonId: kim.id },
  });
  const itemRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Sandwich', price: 10, quantity: 1 } });
  const item = await itemRes.json();
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items/${item.id}/claims`, { data: { personId: kim.id } });
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items/${item.id}/claims`, { data: { personId: lee.id } });

  await expect(joinerPage.getByText('You owe Kim')).toBeVisible({ timeout: 10000 });

  await joinerPage.getByRole('button', { name: 'Detailed' }).click();
  await expect(joinerPage.getByText('Lunch:')).toBeVisible();
  await expect(joinerPage.getByText('you owe Kim')).toBeVisible();

  await joinerPage.getByRole('button', { name: 'Basic' }).click();
  await expect(joinerPage.getByText('Lunch:')).not.toBeVisible();

  await joinerPage.close();
});
