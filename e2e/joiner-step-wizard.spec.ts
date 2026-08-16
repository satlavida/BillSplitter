import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

// Covers req 4: a joiner gets the same step-wise wizard shape as the
// creator (People/Items/Assign/Summary, real routes — mirroring Phase 5's
// BillEditorPage), reached by clicking a bill from JoinerSessionView's bill
// list rather than the old single continuous inline view.

const LIVE_SERVER_URL = 'http://localhost:8080';

test('clicking a bill from the joiner session view opens its step wizard', async ({
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
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const billRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Road Trip Gas', currency: 'USD' } });
  const bill = await billRes.json();
  await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}/items`, { data: { name: 'Fuel', price: 40, quantity: 1 } });

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Nate');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  // Bill list shows the bill title, not its items — click it to enter the wizard.
  await expect(joinerPage.getByText('Road Trip Gas')).toBeVisible({ timeout: 10000 });
  await expect(joinerPage.getByText('Fuel')).not.toBeVisible();
  await joinerPage.getByText('Road Trip Gas').click();
  await joinerPage.waitForURL(new RegExp(`#/join/${code}/bills/${bill.id}/step/1$`));

  // Step 1: People.
  await expect(joinerPage.getByRole('heading', { name: "Who's splitting this bill?" })).toBeVisible();
  await expect(joinerPage.getByText('Nate')).toBeVisible();

  // Step indicator navigates like the creator's (req 4/14).
  await joinerPage.getByRole('button', { name: 'Go to step 2: Items' }).click();
  await joinerPage.waitForURL(new RegExp(`\\/step\\/2$`));
  await expect(joinerPage.getByText('Fuel')).toBeVisible();

  await joinerPage.getByRole('button', { name: 'Go to step 4: Summary' }).click();
  await joinerPage.waitForURL(new RegExp(`\\/step\\/4$`));
  await expect(joinerPage.getByRole('heading', { name: 'Bill Summary' })).toBeVisible();
  await expect(joinerPage.getByText(/Total: USD 40\.00/)).toBeVisible();

  await joinerPage.close();
});
