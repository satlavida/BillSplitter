import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Runs against the real Go backend (server/). Covers req 8: a joiner cannot
// join as the person the creator claimed as their own identity (req 7).

test('a joiner cannot select the creator as their own identity when joining', async ({
  page,
  context,
}: {
  page: Page;
  context: BrowserContext;
}) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(2).selectOption({ label: 'Add myself as a new person…' });
  await page.getByPlaceholder('Your name').fill('Ivy');
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.locator('select').selectOption({ label: 'Ivy' });
  await joinerPage.getByRole('button', { name: 'Join' }).click();

  await expect(joinerPage.getByText(/can't join using the host's own identity/i)).toBeVisible({ timeout: 10000 });

  await joinerPage.close();
});
