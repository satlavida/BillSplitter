import { test, expect, type Page } from '@playwright/test';

// These run against the real Go backend (server/), started alongside the
// Vite dev server via playwright.config.ts's webServer array.

async function addPerson(page: Page, name: string) {
  await page.getByPlaceholder('Enter name').fill(name);
  await page.getByPlaceholder('Enter name').press('Enter');
}

async function goLive(page: Page, joinModeLabel: string): Promise<string> {
  await page.getByRole('button', { name: 'Go Live' }).click();
  await expect(page.getByRole('heading', { name: 'Go Live' })).toBeVisible();
  await page.locator('select').first().selectOption({ label: joinModeLabel });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  return page.locator('span.font-mono.font-semibold').first().innerText();
}

test.describe('Join flow', () => {
  test('open_link mode: joining as an existing person admits immediately', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/session\/[^/]+$/);

    // Seed a person on the session before going live (people are
    // session-scoped, added from the session home page's PeopleSection).
    await addPerson(page, 'Alice');
    await expect(page.getByText('Alice')).toBeVisible();

    const code = await goLive(page, 'Open link (anyone with the link joins instantly)');

    await page.goto(`/#/join/${code}`);
    await expect(page.getByRole('heading', { name: /Join/ })).toBeVisible();

    // Pick the existing person rather than typing a new name.
    await page.locator('select').first().selectOption({ label: 'Alice' });
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.getByText("You're in!")).toBeVisible();
  });

  test('approval_code mode: joining with a new name shows a pending state and a 2-digit code', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/session\/[^/]+$/);

    const code = await goLive(page, 'Approval required (you approve each joiner)');

    await page.goto(`/#/join/${code}`);
    await expect(page.getByRole('heading', { name: /Join/ })).toBeVisible();

    await page.getByPlaceholder('Enter your name').fill('Bob');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.getByText('Waiting for the host to approve you.')).toBeVisible();
    const approvalCode = await page.locator('span.font-mono.font-semibold').first().innerText();
    expect(approvalCode).toMatch(/^[A-Z0-9]{2}$/);
  });

  test('joining a code that does not exist shows a not-found state', async ({ page }) => {
    await page.goto('/#/join/ZZZZZ');
    await expect(page.getByRole('heading', { name: 'Session not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Go home' }).click();
    await expect(page).toHaveURL(/#\/session\/[^/]+$/);
  });
});
