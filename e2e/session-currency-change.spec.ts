import { test, expect, type Page } from '@playwright/test';
import { goLive, LIVE_SERVER_URL, getSessionSnapshot } from './helpers/liveSession';

// Covers a fix for a stale-exchange-rate bug: a bill's exchangeRate is only
// ever meaningful relative to the session currency it was fetched/overridden
// against (see architecture/currency.md). Before the fix, changing a
// session's currency (Session Settings) left every bill's stored rate in
// place, so settlement would silently apply a rate computed for the *old*
// session currency to the new one. setSessionCurrency now clears every
// affected bill's exchangeRate/exchangeRateDate/exchangeRateIsOverride —
// this spec drives that end to end through the real UI (offline) and the
// real Go backend (live), rather than just the store-level unit tests.

async function pickCurrency(page: Page, labelText: string, code: string) {
  const trigger = page.locator('xpath=//label[normalize-space(text())="' + labelText + '"]/following-sibling::div[1]//button[1]');
  await trigger.click();
  await page.getByPlaceholder('Search currency...').fill(code);
  await page.getByRole('button', { name: new RegExp(`^${code} \\(`) }).click();
}

async function setSessionCurrency(page: Page, code: string) {
  await page.getByRole('button', { name: 'Session Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Session Settings' })).toBeVisible();
  await pickCurrency(page, 'Session currency', code);
  await page.getByLabel('Close', { exact: true }).click();
}

async function setBillCurrency(page: Page, code: string) {
  await page.getByRole('button', { name: 'Bill Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Bill Settings' })).toBeVisible();
  await pickCurrency(page, 'Bill currency', code);
}

test.describe('Session currency change — offline', () => {
  test('clears a bill\'s stale exchange rate when the session currency changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/#\/session\/[^/]+$/);
    const sessionId = page.url().match(/#\/session\/([^/]+)/)![1];

    // Session starts in INR.
    await setSessionCurrency(page, 'INR');

    // Add a bill and switch its own currency to USD, then set an override
    // rate against the session's (current) INR currency.
    await page.getByRole('button', { name: 'Add Bill' }).click();
    await page.waitForURL(new RegExp(`#/session/${sessionId}/bill/[^/]+/step/1$`));

    await setBillCurrency(page, 'USD');
    await page.getByPlaceholder('Rate to convert 1 USD to INR').fill('83.5');
    await expect(page.getByText(/Using your own rate/)).toBeVisible();
    await page.getByLabel('Close', { exact: true }).click();

    await page.getByRole('link', { name: '← Back to Session' }).click();
    await page.waitForURL(new RegExp(`#/session/${sessionId}$`));

    // Confirm the rate actually landed before switching currency.
    await page.getByRole('button', { name: 'Session Settings' }).click();
    await expect(page.getByText(/1 USD = 83.5 INR \(override\)/)).toBeVisible();
    await page.getByLabel('Close', { exact: true }).click();

    // Switch the session currency INR -> SGD. The stale USD->INR rate must
    // not silently be reused as a USD->SGD rate.
    await setSessionCurrency(page, 'SGD');

    await page.getByRole('button', { name: 'Session Settings' }).click();
    await expect(page.getByText(/SGD \(/)).toBeVisible();
    // The bill is still currency-mismatched (USD vs SGD), but its rate was
    // cleared, not carried over from the INR-relative value.
    await expect(page.getByText('Not set')).toBeVisible();
    await expect(page.getByText(/1 USD = 83.5/)).not.toBeVisible();
  });
});

test.describe('Session currency change — live', () => {
  test('clears a bill\'s stale exchange rate server-side, visible to a joiner', async ({ page, request }) => {
    const code = await goLive(page);

    const billResp = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/bills`, { data: { title: 'Dinner', currency: 'USD' } });
    const bill = await billResp.json();

    await request.patch(`${LIVE_SERVER_URL}/api/sessions/${code}/bills/${bill.id}`, {
      data: {
        title: 'Dinner',
        currency: 'USD',
        exchangeRate: 83.5,
        exchangeRateDate: '2026-08-01',
        exchangeRateIsOverride: true,
      },
    });

    const before = await getSessionSnapshot(request, code);
    expect(before.bills[0].exchangeRate).toBe(83.5);

    // Switch the session currency via the real Session Settings UI (the
    // creator-only path — see requireCreator in session_handlers.go), not a
    // raw API call, so this exercises the same code path a user hits.
    await setSessionCurrency(page, 'SGD');

    await expect
      .poll(async () => {
        const snap = await getSessionSnapshot(request, code);
        return snap.currency;
      })
      .toBe('SGD');

    const after = await getSessionSnapshot(request, code);
    expect(after.bills[0].exchangeRate).toBeNull();
    expect(after.bills[0].exchangeRateDate).toBeNull();
    expect(after.bills[0].exchangeRateIsOverride).toBe(false);
    // The bill's own currency is untouched by a session currency change.
    expect(after.bills[0].currency).toBe('USD');
  });
});
