import { test, expect } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies
// src/lib/joinerStorage.ts's localStorage-based joinerId persistence —
// without it, a joiner who refreshes /join/:code loses their place and has
// to rejoin from scratch.

async function goLive(page: import('@playwright/test').Page, joinModeLabel: string): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: joinModeLabel });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  return page.locator('span.font-mono.font-semibold').first().innerText();
}

test('a pending joiner who refreshes stays pending without rejoining', async ({ page, context }) => {
  const code = await goLive(page, 'Approval required (you approve each joiner)');

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Holly');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText('Waiting for the host to approve you.')).toBeVisible();
  const approvalCode = await joinerPage.locator('span.font-mono.font-semibold').first().innerText();

  await joinerPage.reload();

  // Restored straight to the pending view — no join form, no new join
  // request (same approval code, not a second one).
  await expect(joinerPage.getByText('Waiting for the host to approve you.')).toBeVisible();
  await expect(joinerPage.getByText(approvalCode)).toBeVisible();

  await joinerPage.close();
});

test('an admitted joiner who refreshes lands back on the claiming screen', async ({ page, context }) => {
  const code = await goLive(page, 'Open link (anyone with the link joins instantly)');

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Ivy');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in! Add items or claim what's yours.")).toBeVisible();

  await joinerPage.reload();

  await expect(joinerPage.getByText("You're in! Add items or claim what's yours.")).toBeVisible();

  await joinerPage.close();
});
