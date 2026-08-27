import { test, expect } from '@playwright/test';

// Mobile (below the lg: breakpoint) right-side panel: toggled via a
// hamburger-style button in the header, only shown once the session is
// live (nothing meaningful to show otherwise), and mutually exclusive with
// the left sidebar so the two don't both eat into the content column.

test('right panel toggle only appears once live, opens/closes, and closes the left sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  // Not live yet — no toggle button.
  await expect(page.getByRole('button', { name: 'Open activity panel' })).not.toBeVisible();

  await page.getByPlaceholder('Enter name').fill('Alice');
  await page.getByPlaceholder('Enter name').press('Enter');
  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();

  const toggleButton = page.getByRole('button', { name: 'Open activity panel' });
  await expect(toggleButton).toBeVisible();

  const panel = page.locator('#mobile-right-panel');
  await expect(panel).toHaveClass(/translate-x-full/);

  await toggleButton.click();
  await expect(panel).toHaveClass(/translate-x-0/);
  await expect(panel.getByTestId('right-panel-people-list')).toBeVisible();
  await expect(panel.getByText('Alice')).toBeVisible();

  // Opening the left sidebar closes the right panel (only one at a time).
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(page.locator('#sidebar')).toHaveClass(/w-64/);
  await expect(panel).toHaveClass(/translate-x-full/);

  // Reopen the right panel (also closes the now-open sidebar); clicking
  // outside it then closes it again.
  await page.getByRole('button', { name: 'Open activity panel' }).click();
  await expect(panel).toHaveClass(/translate-x-0/);
  await expect(page.locator('#sidebar')).not.toHaveClass(/w-64/);
  await page.mouse.click(10, 10);
  await expect(panel).toHaveClass(/translate-x-full/);
});
