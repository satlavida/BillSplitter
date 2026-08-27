import { test, expect, type Page } from '@playwright/test';

// Drives the full 3-step bill editor for a single bill: items -> assignment
// -> summary. People are session-scoped (added on the session home page,
// not as a wizard step) and shared across every bill in the session.
async function addPerson(page: Page, name: string) {
  await page.getByPlaceholder('Enter name').fill(name);
  await page.getByPlaceholder('Enter name').press('Enter');
}

async function addItem(page: Page, name: string, price: string) {
  await page.getByPlaceholder('e.g., Pizza').fill(name);
  await page.getByPlaceholder('0.00').first().fill(price);
  await page.getByRole('button', { name: 'Add Item' }).click();
}

// The root redirect lands on the session home page, not directly in the
// editor — a fresh session starts with zero bills. Add people there first
// (session-scoped), then add a bill to get to step 1 (Items).
async function createSessionWithPeopleAndEnterFirstBill(page: Page, names: string[]): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];
  for (const name of names) {
    await addPerson(page, name);
    await expect(page.getByText(name)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));
  return sessionId;
}

test.describe('Bill editor — full 3-step flow', () => {
  test('items -> assignment -> summary computes correct totals', async ({ page }) => {
    await createSessionWithPeopleAndEnterFirstBill(page, ['Alice', 'Bob']);

    // Step 1: Items
    await expect(page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();
    await addItem(page, 'Pizza', '20');
    await expect(page.getByText('Pizza')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Assignment — split Pizza equally between Alice and Bob
    await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
    await page.getByRole('button', { name: 'Alice', exact: true }).click();
    await page.getByRole('button', { name: 'Bob', exact: true }).click();
    await page.getByRole('button', { name: 'Calculate Split' }).click();

    // Step 3: Summary — 20 split equally is 10 each. Currency defaults to
    // USD (currencyStore's locale auto-detect is currently a no-op).
    await expect(page.getByRole('heading', { name: 'Bill Summary' })).toBeVisible();
    await expect(page.getByText('$10.00').first()).toBeVisible();
  });

  test('bill edits commit back to the session and survive a bill switch', async ({ page }) => {
    const sessionId = await createSessionWithPeopleAndEnterFirstBill(page, ['Alice']);

    await addItem(page, 'Coffee', '5');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Alice', exact: true }).click();
    await page.getByRole('button', { name: 'Calculate Split' }).click();

    // Add a second bill from the summary screen.
    await page.getByRole('button', { name: 'Add Another Bill' }).click();
    await expect(page).toHaveURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));
    await expect(page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();

    // Go back to the session home; both bills should now be listed, and the
    // shared people pool still has Alice.
    // Scoped to the bill list specifically — the session home page also has
    // a People list (PeopleSection) with its own <ul><li> items.
    await page.goto(`/#/session/${sessionId}`);
    const bills = page.getByTestId('bill-list').locator('li');
    await expect(bills).toHaveCount(2);
    await expect(page.getByText('Alice')).toBeVisible();
  });

  test('paid-by selector persists to the session', async ({ page }) => {
    await createSessionWithPeopleAndEnterFirstBill(page, ['Alice']);

    await addItem(page, 'Snacks', '8');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Alice', exact: true }).click();
    await page.getByRole('button', { name: 'Calculate Split' }).click();

    await expect(page.getByRole('heading', { name: 'Who Paid?' })).toBeVisible();
    const paidBySelect = page.locator('select').first();
    await paidBySelect.selectOption({ label: 'Alice' });
    await expect(paidBySelect).not.toHaveValue('');

    // Reload to confirm the selection was persisted via sessionStore, not just
    // local billStore state (a reload always re-hydrates the editor at step 1).
    await page.reload();
    await page.getByRole('button', { name: 'Go to step 3: Summary' }).click();
    await expect(page.locator('select').first()).not.toHaveValue('');
  });
});
