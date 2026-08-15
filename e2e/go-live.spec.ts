import { test, expect } from '@playwright/test';

// No Go live-collaboration server runs alongside these e2e tests (see
// navigation.spec.ts's join-flow test for the same reasoning) — this
// exercises the "Go Live" button's own error path when that fetch fails,
// without needing a real server.
test.describe('Go Live', () => {
  test('surfaces an error when the live server is unreachable', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/session\/[^/]+$/);

    await page.getByRole('button', { name: 'Go Live' }).click();
    await expect(page.getByRole('heading', { name: 'Go Live' })).toBeVisible();

    await page.getByRole('button', { name: 'Start Live Session' }).click();
    await expect(page.getByText(/Could not reach the live server/i)).toBeVisible();
  });

  test('Cancel collapses the form back to the button', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/session\/[^/]+$/);

    await page.getByRole('button', { name: 'Go Live' }).click();
    await expect(page.getByRole('heading', { name: 'Go Live' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Go Live' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Go Live' })).not.toBeVisible();
  });
});
