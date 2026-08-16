import { test, expect } from '@playwright/test';

// Covers req 15: the creator can delete the online/live mirror of a
// session (never the local/offline data) via a confirm-gated button.

test('creator deletes the online session and can go live again', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Online Session' }).click();
  await expect(page.getByText('Delete the online session? Your local data stays intact.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Delete' }).click();

  // Back to the pre-live Go Live form, local session untouched.
  await expect(page.getByRole('heading', { name: 'Go Live' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Live', exact: true })).not.toBeVisible();

  // Can go live again afterwards.
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
});
