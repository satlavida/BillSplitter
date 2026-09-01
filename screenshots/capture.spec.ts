import { test, expect, type Page } from '@playwright/test';
import { createShooter } from './shooter';

// Walks every client-facing route (i.e. everything in src/App.tsx's <Routes>
// except the dev-only /dev/receipt-scan-test tool) with a realistically
// populated session — two people, a bill with two items fully split, a live
// session with a second person joined — and screenshots each one. Not an
// assertion suite: a handful of `expect(...).toBeVisible()` calls exist only
// to make sure navigation actually landed before shooting, not to check
// behavior (that's what e2e/ is for). Run via `npm run screenshots`; see
// screenshots/README.md for output layout.
async function addPerson(page: Page, name: string) {
  await page.getByPlaceholder('Enter name').fill(name);
  await page.getByPlaceholder('Enter name').press('Enter');
}

async function addItem(page: Page, name: string, price: string) {
  await page.getByPlaceholder('e.g., Pizza').fill(name);
  await page.getByPlaceholder('0.00').first().fill(price);
  await page.getByRole('button', { name: 'Add Item' }).click();
}

// ServiceWorkerPrompt.tsx's "App ready to work offline" banner is a
// fixed, bottom-center, never-auto-dismissing overlay that (on the narrow
// phone viewport especially) can land on top of a button mid-flow and
// block every click there forever — Playwright retries a blocked click
// indefinitely up to the test timeout rather than failing fast, and the
// service worker's registration/precache completes at a non-deterministic
// point relative to the rest of the flow, so there's no single "dismiss it
// here" spot that's reliably safe. Simplest fix: never let it register at
// all for these capture-only pages — stub out `navigator.serviceWorker
// .register` before any page script runs, so `useRegisterSW` never flips
// `offlineReady`/`needRefresh` and the banner never renders.
async function disableServiceWorker(page: Page) {
  await page.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register = () => Promise.reject(new Error('disabled for screenshots'));
    }
  });
}

test('capture all client pages', async ({ page, browser }, testInfo) => {
  test.slow();
  const shoot = createShooter(testInfo.project.name);

  // --- Creator: new session, people, a fully-split bill ---
  await disableServiceWorker(page);
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);
  const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

  await addPerson(page, 'Alice');
  await addPerson(page, 'Bob');

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));
  const billId = page.url().match(/bill\/([^/]+)\/step/)![1];

  await addItem(page, 'Pizza', '24');
  await addItem(page, 'Salad', '12');
  await expect(page.getByText('Pizza')).toBeVisible();
  await shoot(page, 'bill-editor-items');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();
  // One toggle button per person per item card (two items -> two "Alice"
  // buttons, two "Bob" buttons) — snapshot the matches with .all() and click
  // each by reference, rather than a "click first until none left" loop
  // (tried that with the "Select All" button first; it never converged).
  for (const toggle of await page.getByRole('button', { name: 'Alice', exact: true }).all()) {
    await toggle.click();
  }
  for (const toggle of await page.getByRole('button', { name: 'Bob', exact: true }).all()) {
    await toggle.click();
  }
  await shoot(page, 'bill-editor-assign');

  await page.getByRole('button', { name: 'Calculate Split' }).click();
  await expect(page.getByRole('heading', { name: 'Bill Summary' })).toBeVisible();
  await page.locator('select').first().selectOption({ label: 'Alice' });
  await shoot(page, 'bill-editor-summary');

  // --- Creator: go live (also seeds the "Live" panel for session-home) ---
  await page.goto(`/#/session/${sessionId}`);
  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.locator('select').nth(1).selectOption({ label: 'Edit (joiners can add and claim items directly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();
  await shoot(page, 'session-home');

  await page.goto(`/#/session/${sessionId}/settlement`);
  await expect(page.getByRole('heading', { name: 'Settlement' })).toBeVisible();
  await shoot(page, 'settlement');

  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await shoot(page, 'settings');

  // --- Joiner: separate browser context, own localStorage (joinerStorage.ts
  // keys purely by session code, so two pages in one context would collide) ---
  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await disableServiceWorker(joinerPage);
  // HashRouter (see src/App.tsx's comment on why) — every in-app route
  // needs the leading `#`, or Vite's dev-server SPA fallback serves
  // index.html at an empty hash and RootRedirect silently sends us to a
  // brand-new session instead of the join flow.
  await joinerPage.goto(`/#/join/${code}`);
  await expect(joinerPage.getByPlaceholder('Enter your name')).toBeVisible();
  await shoot(joinerPage, 'join-form');

  await joinerPage.getByPlaceholder('Enter your name').fill('Charlie');
  await joinerPage.getByRole('button', { name: 'Join' }).click();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();
  await shoot(joinerPage, 'join-session-view');

  await joinerPage.goto(`/#/join/${code}/bills/${billId}/step/1`);
  await expect(joinerPage.getByRole('heading', { name: 'What items are you splitting?' })).toBeVisible();
  await shoot(joinerPage, 'joiner-bill-items');

  await joinerPage.goto(`/#/join/${code}/bills/${billId}/step/2`);
  await expect(joinerPage.getByRole('heading', { name: "Claim what's yours" })).toBeVisible();
  await shoot(joinerPage, 'joiner-bill-claim');

  await joinerPage.goto(`/#/join/${code}/bills/${billId}/step/3`);
  await expect(joinerPage.getByRole('heading', { name: 'Bill Summary' })).toBeVisible();
  await shoot(joinerPage, 'joiner-bill-summary');

  await joinerContext.close();

  // --- Creator: activity log now has a join event, sessions list now has
  // this session to show ---
  await page.goto(`/#/session/${sessionId}/activity`);
  await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
  await shoot(page, 'activity-log');

  await page.goto('/#/sessions');
  await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
  await shoot(page, 'sessions-list');
});
