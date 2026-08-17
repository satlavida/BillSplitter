import { test, expect, type Page } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies
// src/lib/joinedSessionsStorage.ts + the "Sessions You've Joined" section on
// SessionsListPage.tsx: a joiner's own Sessions list shows the sessions
// they've joined (as distinct from sessionStore's locally-created ones),
// reconciled against the server's batch status endpoint
// (GET-less POST /api/sessions/status, server/internal/api/session_handlers.go).

async function goLive(page: Page): Promise<string> {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  return page.locator('span.font-mono.font-semibold').first().innerText();
}

test('a joiner sees the session they joined on their own Sessions list, with live status', async ({ page, context }) => {
  const code = await goLive(page);

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Nora');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  // Same browser context/localStorage, navigate to the joiner's own
  // Sessions list — it must show the session it just joined, distinct from
  // any locally-created sessions.
  await joinerPage.goto('/#/sessions');
  await expect(joinerPage.getByRole('heading', { name: "Sessions You've Joined" })).toBeVisible();
  const joinedRow = joinerPage.locator('li', { hasText: 'Nora' });
  await expect(joinedRow).toBeVisible();
  await expect(joinedRow.getByText('Active', { exact: true })).toBeVisible({ timeout: 10000 });

  // The creator settles the session — the joiner's list should reflect it
  // as Settled on the next load, not silently keep showing Active.
  await expect(page.getByRole('heading', { name: 'Settle Up' })).toBeVisible();
  await page.getByRole('button', { name: 'Settle Up' }).click();
  await page.getByRole('button', { name: 'Confirm Settle' }).click();
  await expect(page.getByText('This session has been settled.')).toBeVisible();

  // Already on /#/sessions from the check above — goto() with an unchanged
  // hash is a same-document no-op in the browser, so force a real reload to
  // remount the page and refetch status.
  await joinerPage.reload();
  await expect(joinerPage.locator('li', { hasText: 'Nora' }).getByText('Settled', { exact: true })).toBeVisible({ timeout: 10000 });

  // Removing the entry drops it from the list.
  await joinerPage.locator('li', { hasText: 'Nora' }).getByRole('button', { name: 'Remove' }).click();
  await expect(joinerPage.getByRole('heading', { name: "Sessions You've Joined" })).not.toBeVisible();
});
