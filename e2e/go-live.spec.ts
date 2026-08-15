import { test, expect } from '@playwright/test';

// These run against the real Go backend (server/), started alongside the
// Vite dev server via playwright.config.ts's webServer array.
test.describe('Go Live', () => {
  test('starting a live session shows a real code and join link', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/session\/[^/]+$/);

    await page.getByRole('button', { name: 'Go Live' }).click();
    await expect(page.getByRole('heading', { name: 'Go Live' })).toBeVisible();

    await page.getByRole('button', { name: 'Start Live Session' }).click();

    await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
    const code = await page.locator('span.font-mono.font-semibold').first().innerText();
    expect(code).toMatch(/^[A-Z0-9]{5}$/);
    await expect(page.getByText(new RegExp(`join/${code}`))).toBeVisible();
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
