import { test, expect, type Page } from '@playwright/test';

// Drives the full 4-step bill editor for a single bill: people -> items -> assignment -> summary.
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
// editor — a fresh session starts with zero bills. Add one to get to step 1.
async function createSessionAndEnterFirstBill(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];
  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+$`));
  return sessionId;
}

test.describe('Bill editor — full 4-step flow', () => {
  test('people -> items -> assignment -> summary computes correct totals', async ({ page }) => {
    await createSessionAndEnterFirstBill(page);

    // Step 1: People
    await addPerson(page, 'Alice');
    await addPerson(page, 'Bob');
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Items
    await expect(page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();
    await addItem(page, 'Pizza', '20');
    await expect(page.getByText('Pizza')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Assignment — split Pizza equally between Alice and Bob
    await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
    await page.getByRole('button', { name: 'Alice', exact: true }).click();
    await page.getByRole('button', { name: 'Bob', exact: true }).click();
    await page.getByRole('button', { name: 'Calculate Split' }).click();

    // Step 4: Summary — 20 split equally is 10 each. Currency defaults to
    // USD (currencyStore's locale auto-detect is currently a no-op).
    await expect(page.getByRole('heading', { name: 'Bill Summary' })).toBeVisible();
    await expect(page.getByText('$10.00').first()).toBeVisible();
  });

  test('bill edits commit back to the session and survive a bill switch', async ({ page }) => {
    const sessionId = await createSessionAndEnterFirstBill(page);

    await addPerson(page, 'Alice');
    await page.getByRole('button', { name: 'Next' }).click();
    await addItem(page, 'Coffee', '5');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Alice', exact: true }).click();
    await page.getByRole('button', { name: 'Calculate Split' }).click();

    // Add a second bill from the summary screen.
    await page.getByRole('button', { name: 'Add Another Bill' }).click();
    await expect(page).toHaveURL(new RegExp(`#/session/${sessionId}/bill/[^/]+$`));
    await expect(page.getByRole('heading', { name: "Who's splitting the bill?" })).toBeVisible();

    // Shared people pool: Alice should already be present on the new bill.
    await expect(page.getByText('Alice')).toBeVisible();

    // Go back to the session home; both bills should now be listed.
    await page.goto(`/#/session/${sessionId}`);
    const bills = page.locator('ul li');
    await expect(bills).toHaveCount(2);
  });

  test('paid-by selector persists to the session', async ({ page }) => {
    await createSessionAndEnterFirstBill(page);

    await addPerson(page, 'Alice');
    await page.getByRole('button', { name: 'Next' }).click();
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
    await page.getByRole('button', { name: 'Go to step 4: Summary' }).click();
    await expect(page.locator('select').first()).not.toHaveValue('');
  });
});
