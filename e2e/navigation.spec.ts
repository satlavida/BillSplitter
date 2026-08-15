import { test, expect } from '@playwright/test';

test.describe('Root redirect and shell', () => {
  test('"/" creates a session on first visit and redirects to its home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/#\/session\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Bills' })).toBeVisible();
    await expect(page.getByText('No bills yet.')).toBeVisible();
  });

  test('sidebar navigates between Sessions and Settings', async ({ page }) => {
    await page.goto('/#/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();

    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('unknown session/bill ids redirect back to /sessions', async ({ page }) => {
    await page.goto('/#/session/does-not-exist/bill/does-not-exist');
    await expect(page).toHaveURL(/#\/sessions$/);
  });

  test('/join/:code shows the live-collaboration placeholder', async ({ page }) => {
    await page.goto('/#/join/ABCDE');
    await expect(page.getByRole('heading', { name: 'Join Session ABCDE' })).toBeVisible();
    await page.getByRole('link', { name: 'Go home' }).click();
    await expect(page).toHaveURL(/#\/session\/[^/]+$/);
  });

  test('browser back/forward moves across routes', async ({ page }) => {
    await page.goto('/#/sessions');
    await page.getByRole('button', { name: 'New Session' }).click();
    await expect(page).toHaveURL(/#\/session\/[^/]+$/);

    await page.goBack();
    await expect(page).toHaveURL(/#\/sessions$/);

    await page.goForward();
    await expect(page).toHaveURL(/#\/session\/[^/]+$/);
  });
});
