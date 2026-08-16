import { test, expect } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies the
// Disapprove path in LiveSessionPanel.tsx — wired up alongside Approve
// since the joiner-scope-expansion work, but never previously e2e-tested.

test('creator disapproves a pending joiner, who sees the rejection and can try again', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Approval required (you approve each joiner)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.getByPlaceholder('Enter your name').fill('Nina');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText('Waiting for the host to approve you.')).toBeVisible();

  await expect(page.getByText('Nina')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Disapprove', exact: true }).click();

  // The creator's own list reflects the decision.
  await expect(page.getByText('Nina')).toBeVisible();
  await expect(page.getByText('disapproved')).toBeVisible({ timeout: 10000 });

  // The joiner's still-open page picks up the rejection live.
  await expect(joinerPage.getByText("The host didn't approve your request to join.")).toBeVisible({ timeout: 10000 });

  // Clicking "Try again" clears the stored (disapproved) joiner id and
  // returns to a fresh join form — not a stale disapproved state.
  await joinerPage.getByRole('button', { name: 'Try again' }).click();
  await expect(joinerPage.getByPlaceholder('Enter your name')).toBeVisible();

  // Confirmed via a page reload too: nothing in localStorage should
  // restore the disapproved joiner.
  await joinerPage.reload();
  await expect(joinerPage.getByPlaceholder('Enter your name')).toBeVisible();
  await expect(joinerPage.getByText('Waiting for the host to approve you.')).not.toBeVisible();

  await joinerPage.close();
});
