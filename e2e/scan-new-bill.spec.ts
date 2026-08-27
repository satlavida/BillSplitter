import { test, expect } from '@playwright/test';

// "Scan New Bill" on SessionHomePage creates an empty bill and navigates
// straight into its Items step with ScanReceiptButton's upload modal already
// open, instead of requiring "Add Bill" then a separate "Scan Receipt"
// click. Doesn't drive an actual scan (that needs a real OpenRouter key —
// see live-receipt-image.spec.ts's comment on why that's out of scope for
// e2e), just that the shortcut lands in the right place with the modal open.

test('Scan New Bill creates a bill and opens the scan modal immediately', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await page.getByRole('button', { name: 'Scan New Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));

  await expect(page.getByRole('heading', { name: 'Upload Receipt' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();

  // Closing the modal and reloading shouldn't re-open it — the nav-state
  // flag is a one-shot, cleared via history.replaceState.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Upload Receipt' })).not.toBeVisible();
});
