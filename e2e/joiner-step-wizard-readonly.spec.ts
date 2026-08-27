import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

// In a read-only session, the joiner's step wizard still renders every step
// (Items/Assign/Summary) but with no edit controls — same permission gate as
// joiner-read-only-permission.spec.ts, exercised through the step-wizard's
// own Items/Summary steps this time.

const LIVE_SERVER_URL = 'http://localhost:8080';

test('read-only session: joiner can step through the wizard but sees no edit controls', async ({
  page,
  context,
  request,
}: {
  page: Page;
  context: BrowserContext;
  request: APIRequestContext;
}) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Read-only (joiners can only view your changes)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Groceries', currency: 'USD' } });
  const bill = await billRes.json();
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Milk', price: 4, quantity: 1 } });

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Owen');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! You can view the host's changes here.")).toBeVisible();

  await joinerPage.getByText('Groceries').click();
  await joinerPage.waitForURL(new RegExp(`#/join/${code}/bills/${bill.id}/step/1$`));
  await expect(joinerPage.getByText('The host has this session set to view-only.')).toBeVisible();

  await joinerPage.getByRole('button', { name: 'Go to step 3: Summary' }).click();
  await expect(joinerPage.getByRole('heading', { name: 'Bill Summary' })).toBeVisible();
  await expect(joinerPage.getByText('Milk')).toBeVisible();
  await expect(joinerPage.getByText(/Total: USD 4\.00/)).toBeVisible();

  await joinerPage.close();
});
