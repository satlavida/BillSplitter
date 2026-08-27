import { test, expect, type Page } from '@playwright/test';

async function addPerson(page: Page, name: string) {
  await page.getByPlaceholder('Enter name').fill(name);
  await page.getByPlaceholder('Enter name').press('Enter');
}

async function addItem(page: Page, name: string, price: string) {
  await page.getByPlaceholder('e.g., Pizza').fill(name);
  await page.getByPlaceholder('0.00').first().fill(price);
  await page.getByRole('button', { name: 'Add Item' }).click();
}

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

test.describe('Settlement view', () => {
  test('shows correct net balances across a single bill paid by one person', async ({ page }) => {
    const sessionId = await createSessionWithPeopleAndEnterFirstBill(page, ['Alice', 'Bob']);

    await addItem(page, 'Dinner', '40');
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByRole('button', { name: 'Alice', exact: true }).click();
    await page.getByRole('button', { name: 'Bob', exact: true }).click();
    await page.getByRole('button', { name: 'Calculate Split' }).click();

    // Alice paid the full 40, split equally -> Bob owes Alice 20.
    const paidBySelect = page.locator('select').first();
    await paidBySelect.selectOption({ label: 'Alice' });

    await page.goto(`/#/session/${sessionId}/settlement`);
    await expect(page.getByRole('heading', { name: 'Settlement' })).toBeVisible();
    await expect(page.getByText(/Bob.*is owed|Alice.*is owed/)).toBeVisible();
    await expect(page.getByText(/pays.*\$20\.00/)).toBeVisible();
  });

  test('shows "settled up" when there is nothing to reconcile', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/session\/[^/]+$/);
    const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];
    await page.goto(`/#/session/${sessionId}/settlement`);
    await expect(page.getByText('No people in this session yet.')).toBeVisible();
    await expect(page.getByText('Everyone is settled up.')).toBeVisible();
  });
});
