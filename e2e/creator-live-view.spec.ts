import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// These run against the real Go backend (server/), started alongside the
// Vite dev server via playwright.config.ts's webServer array. Two browser
// tabs stand in for the creator and a joiner, since the SSE/poll-driven
// creator-side live view (src/Components/LiveSessionPanel.tsx) only has
// something to show once a real joiner hits the real server.

async function addPerson(page: Page, name: string) {
  await page.getByPlaceholder('Enter name').fill(name);
  await page.getByPlaceholder('Enter name').press('Enter');
}

test('creator sees a pending joiner appear live and can approve them', async ({ page, context }: { page: Page; context: BrowserContext }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await addPerson(page, 'Alice');
  await expect(page.getByText('Alice')).toBeVisible();

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));
  await page.getByRole('button', { name: '← Back to Session' }).click();
  await page.waitForURL(`http://localhost:5173/#/session/${sessionId}`);

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Approval required (you approve each joiner)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  // The Joiners panel starts out empty.
  await expect(page.getByRole('heading', { name: 'Joiners' })).toBeVisible();
  await expect(page.getByText('No one has joined yet.')).toBeVisible();

  // A second "browser" (joiner) requests to join with a new name.
  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await expect(joinerPage.getByRole('heading', { name: /Join/ })).toBeVisible();
  await joinerPage.getByPlaceholder('Enter your name').fill('Bob');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText('Waiting for the host to approve you.')).toBeVisible();

  // The creator's live panel picks up the pending joiner without a reload.
  // (Once approved, "Bob" also becomes a session-level person shown by
  // PeopleSection above — `.last()` targets the Joiners panel entry, which
  // renders after it in the DOM.)
  await expect(page.getByText('Bob').last()).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Approve', exact: true }).click();

  await expect(page.getByText('Bob').last()).toBeVisible();
  await expect(page.getByText('approved')).toBeVisible({ timeout: 10000 });

  await joinerPage.close();
});
