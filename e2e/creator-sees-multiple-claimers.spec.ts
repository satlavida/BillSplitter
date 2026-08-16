import { test, expect, type Page, type Browser, type BrowserContext } from '@playwright/test';

// Runs against the real Go backend (server/), started alongside the Vite
// dev server via playwright.config.ts's webServer array. Verifies the fix
// in commit "creator's bill editor now live-updates while open": the
// creator sits in ItemAssignment (step 3) the entire time, never
// navigating away, while multiple joiners in separate browser contexts
// claim items — and sees each claim reflected without a manual refresh.

async function joinAndClaim(browser: Browser, code: string, name: string, itemName: string): Promise<{ page: Page; context: BrowserContext }> {
  // Each joiner needs its own browser context — joinerStorage.ts keys the
  // stored joiner id purely by session code, so two pages sharing a
  // context collide (see joiner-fraction-stepper.spec.ts, which hit this).
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/#/join/${code}`);
  await page.getByPlaceholder('Enter your name').fill(name);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByText("You're in!")).toBeVisible();

  await expect(page.getByText(itemName, { exact: true })).toBeVisible({ timeout: 10000 });
  await page
    .locator('li', { hasText: itemName })
    .getByRole('button', { name: 'Claim', exact: true })
    .click();

  return { page, context };
}

test('creator sitting in the bill editor sees multiple claimers update live, without navigating away', async ({ page, browser }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Edit (joiners can add and claim items directly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.getByRole('button', { name: 'Go to step 2: Items' }).click();

  await page.getByPlaceholder('e.g., Pizza').fill('Pizza');
  await page.getByPlaceholder('0.00').first().fill('20');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByPlaceholder('e.g., Pizza').fill('Nachos');
  await page.getByPlaceholder('0.00').first().fill('10');
  await page.getByRole('button', { name: 'Add Item' }).click();

  await page.getByRole('button', { name: 'Go to step 3: Assign' }).click();
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();

  // Each item renders as its own Card (ItemAssignment.tsx's ItemCard) —
  // scope assertions to the card containing that item's name so "Pizza"
  // and "Nachos" claims can't be confused with each other. Card's own base
  // classes include shadow-sm (ui/components.tsx), distinguishing it from
  // the app shell's outer rounded-xl wrapper (shadow-lg).
  const pizzaCard = page.locator('div.rounded-xl.shadow-sm', { hasText: 'Pizza' });
  const nachosCard = page.locator('div.rounded-xl.shadow-sm', { hasText: 'Nachos' });

  // Two joiners claim two different items, without the creator ever
  // navigating away from step 3.
  const alice = await joinAndClaim(browser, code, 'Alice', 'Pizza');
  await expect(pizzaCard.getByText('Split between:')).toBeVisible({ timeout: 10000 });
  await expect(pizzaCard).toContainText('Alice', { timeout: 10000 });

  const bob = await joinAndClaim(browser, code, 'Bob', 'Nachos');
  await expect(nachosCard).toContainText('Bob', { timeout: 10000 });

  // A third joiner claims the SAME item as Alice — the creator should see
  // both names listed together, not one overwriting the other.
  const carol = await joinAndClaim(browser, code, 'Carol', 'Pizza');
  await expect(pizzaCard.getByText(/Split between:.*Alice.*Carol|Split between:.*Carol.*Alice/)).toBeVisible({ timeout: 10000 });

  await alice.page.close();
  await alice.context.close();
  await bob.page.close();
  await bob.context.close();
  await carol.page.close();
  await carol.context.close();
});
