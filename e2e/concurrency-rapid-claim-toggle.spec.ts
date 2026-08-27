import { test, expect } from '@playwright/test';
import { goLive, getSessionSnapshot } from './helpers/liveSession';

// Regression coverage for commit 9a3c349 (pendingLiveWrites.ts): the
// creator's ItemAssignment ToggleButton writes consumedBy locally and
// fire-and-forgets a push to the live server (sessionStore.ts's
// syncConsumedByLive/pushClaimLive/pushUnclaimLive), while the creator's own
// live-session refresh loop can independently pull in a snapshot at any
// time. Before the fix, a snapshot that landed after a push was sent but
// before it was acknowledged would clobber the just-made local edit.
// pendingLiveWrites.ts is refcounted (not boolean) specifically so rapid
// double-toggles of the *same* key don't have the first push's completion
// clear the guard while a second is still in flight.

test("creator rapidly toggling one person's claim on/off/on converges to the final state, not a reverted one", async ({ page, browser, request }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  // Bob must exist as a session person before the bill editor loads —
  // ItemAssignment's per-person ToggleButton list comes from billStore's
  // `people`, hydrated in full from session.people (BillEditorPage.tsx),
  // not filtered to prior bill participants.
  await page.getByPlaceholder('Enter name').fill('Bob');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  const code = await goLive(page);

  await page.getByRole('button', { name: 'Add Bill' }).click();
  await page.waitForURL(/\/bill\/[^/]+\/step\/1$/);
  await page.getByPlaceholder('e.g., Pizza').fill('Pizza');
  await page.getByPlaceholder('0.00').first().fill('20');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Go to step 2: Assign' }).click();
  await expect(page.getByRole('heading', { name: 'Who consumed what?' })).toBeVisible();

  const pizzaCard = page.locator('div.rounded-xl.shadow-sm', { hasText: 'Pizza' });
  const bobToggle = pizzaCard.getByRole('button', { name: 'Bob', exact: true });

  // Three clicks fired back-to-back with no awaited network settle or
  // assertion between them — that's the "rapid" part. billStore updates
  // (and pushes) synchronously per click, so this genuinely produces
  // overlapping in-flight pushes to the same pendingLiveWrites key
  // (`item:<id>:consumedBy`), not just fast-but-serialized requests.
  await bobToggle.click(); // claim
  await bobToggle.click(); // unclaim
  await bobToggle.click(); // claim

  await expect(pizzaCard.getByText('Split between:')).toBeVisible({ timeout: 10000 });
  await expect(pizzaCard).toContainText('Bob', { timeout: 10000 });

  const isBobClaimed = async () => {
    const snapshot = await getSessionSnapshot(request, code);
    const bob = snapshot.people.find((p: { name: string }) => p.name === 'Bob');
    const item = snapshot.bills[0].items[0];
    return item.consumedBy.some((c: { personId: string }) => c.personId === bob?.id);
  };

  await expect.poll(isBobClaimed, { timeout: 10000 }).toBe(true);

  // Re-check after a short gap — the point of the refcount guard is that
  // the claimed state doesn't get reverted by a *later* stale snapshot
  // merge, not just that it looks right in the first instant.
  await page.waitForTimeout(1500);
  expect(await isBobClaimed()).toBe(true);
  await expect(pizzaCard).toContainText('Bob', { timeout: 10000 });
});
