import { test, expect, type Page } from '@playwright/test';

// The settlement page's Basic/Detailed toggle: Basic keeps the existing
// aggregate "Bills" list (title + total only); Detailed adds a per-bill
// "who owes whom on this bill" breakdown (calculateBillBalances).

async function addPerson(page: Page, name: string) {
  await page.getByPlaceholder('Enter name').fill(name);
  await page.getByPlaceholder('Enter name').press('Enter');
}

async function addItem(page: Page, name: string, price: string) {
  await page.getByPlaceholder('e.g., Pizza').fill(name);
  await page.getByPlaceholder('0.00').first().fill(price);
  await page.getByRole('button', { name: 'Add Item' }).click();
}

test('Detailed toggle shows a per-bill who-owes-whom breakdown', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await addPerson(page, 'Alice');
  await addPerson(page, 'Bob');
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));
  await addItem(page, 'Dinner', '40');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('button', { name: 'Bob', exact: true }).click();
  await page.getByRole('button', { name: 'Calculate Split' }).click();

  const paidBySelect = page.locator('select').first();
  await paidBySelect.selectOption({ label: 'Alice' });

  await page.goto(`/#/session/${sessionId}/settlement`);

  // Basic mode (default): no per-bill breakdown line.
  await expect(page.getByText('Bob owes Alice')).not.toBeVisible();

  await page.getByRole('button', { name: 'Detailed' }).click();
  await expect(page.getByText('Paid by Alice')).toBeVisible();
  await expect(page.getByText('Bob owes')).toBeVisible();

  await page.getByRole('button', { name: 'Basic' }).click();
  await expect(page.getByText('Bob owes')).not.toBeVisible();
});
