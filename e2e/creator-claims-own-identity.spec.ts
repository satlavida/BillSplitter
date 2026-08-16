import { test, expect } from '@playwright/test';

// Runs against the real Go backend (server/). Covers req 7: the creator can
// pick "which person are you?" when going live, either an existing session
// person or a brand-new one added on the spot.

test('creator adds a new person as themselves when going live', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await expect(page.getByRole('heading', { name: 'Go Live' })).toBeVisible();

  await page.locator('select').nth(2).selectOption({ label: 'Add myself as a new person…' });
  await page.getByPlaceholder('Your name').fill('Hank');

  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();

  // The creator's new identity also shows up in the session-level people list.
  await expect(page.getByText('Hank', { exact: true })).toBeVisible();
});
