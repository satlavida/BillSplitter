import { test, expect } from '@playwright/test';

// The creator can't rename a person while they're claimed by an active
// joiner (src/lib/presenceRules.ts's isNameEditLocked) — the pencil-icon
// edit button on PeopleSection disables itself while that joiner is
// online. An unclaimed person's edit button stays enabled throughout.

const LIVE_SERVER_URL = 'http://localhost:8080';

test('edit button disables while a claimed person is actively online', async ({ page, context, request }) => {
  await page.goto('/');
  await page.waitForURL(/#\/session\/[^/]+$/);

  await page.getByPlaceholder('Enter name').fill('Alice');
  await page.getByPlaceholder('Enter name').press('Enter');
  await expect(page.getByText('Alice')).toBeVisible();

  // The edit button's accessible name changes once locked (see
  // PeopleListShared.tsx's PersonListItem), so locate it structurally
  // (first button in Alice's list item) rather than by name.
  const aliceEditButton = page.locator('li', { hasText: 'Alice' }).getByRole('button').first();

  // Unclaimed: edit button enabled.
  await expect(aliceEditButton).toBeEnabled();

  await page.getByRole('button', { name: 'Go Live' }).click();
  await page.locator('select').first().selectOption({ label: 'Open link (anyone with the link joins instantly)' });
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible();
  const code = await page.locator('span.font-mono.font-semibold').first().innerText();

  const sessRes = await request.get(`${LIVE_SERVER_URL}/api/sessions/${code}`);
  const sess = await sessRes.json();
  const alice = sess.people.find((p: { name: string }) => p.name === 'Alice');

  // Joins as Alice's existing identity directly against the API (the join
  // page's existing-person picker is a SearchSelect combobox, not a native
  // <select>, and driving that from Playwright is a separate, unrelated
  // known gap — see UIV3_27_08_2026log.md), then seeds this browser's
  // joiner-identity storage so JoinerSessionView mounts (and starts
  // heartbeating) the same way it would after a real join.
  const joinRes = await request.post(`${LIVE_SERVER_URL}/api/sessions/${code}/join`, {
    data: { name: 'Alice', existingPersonId: alice.id },
  });
  const joiner = await joinRes.json();

  const joinerPage = await context.newPage();
  await joinerPage.goto(`/#/join/${code}`);
  await joinerPage.evaluate(
    ({ code, joinerId, token }) => {
      localStorage.setItem(`billsplitter-joiner:${code}`, joinerId);
      localStorage.setItem(`billsplitter-joiner-token:${code}`, token);
    },
    { code, joinerId: joiner.id, token: joiner.token }
  );
  await joinerPage.reload();
  await expect(joinerPage.getByText("You're in!")).toBeVisible();

  // Still online (heartbeating every 1.5s) — edit button should disable.
  await expect(aliceEditButton).toBeDisabled({ timeout: 10000 });

  // Once the joiner tab closes (stops heartbeating), presence goes stale
  // and the edit button re-enables (this test's "offline" case is simply
  // "not currently online" — see presenceRules.ts's documented limitation).
  await joinerPage.close();
  await expect(aliceEditButton).toBeEnabled({ timeout: 10000 });
});
