// Ad-hoc manual repro script (not part of the Jest/Playwright suites) used
// while debugging whether BillSummary's Print button fires window.print()
// unexpectedly around a "Go Live" transition and subsequent back-navigation
// — see architecture/bill-editing.md's Print notes. Creator-only flow: add a
// person/item, split, start a live session, navigate back into the bill,
// click Print, then navigate away, logging whether window.print() actually
// fired at each point.
//
// Run manually against a dev server already running on :5173
// (`npm run dev`): `node tmp/scripts_tmp_live.mjs`. Screenshots land in
// /tmp/live_*.png. Not run in CI or npm test/e2e.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

const printEvents = [];
await page.exposeFunction('__printCalled', () => { printEvents.push(Date.now()); });
await page.addInitScript(() => { window.print = () => { window.__printCalled(); }; });

await page.goto('http://localhost:5173/');
await page.waitForTimeout(800);
const getStarted = page.getByRole('button', { name: 'Get Started' });
if (await getStarted.isVisible().catch(() => false)) await getStarted.click();
await page.waitForTimeout(300);
const closeToast = page.getByRole('button', { name: 'Close' });
if (await closeToast.isVisible().catch(() => false)) await closeToast.click();

const personInput = page.getByPlaceholder(/name/i).first();
await personInput.fill('Alice');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);

const addBillBtn = page.getByRole('button', { name: /add.*bill|new bill|create bill/i }).first();
await addBillBtn.click();
await page.waitForTimeout(500);
const cancelBtn = page.getByRole('button', { name: 'Cancel' });
if (await cancelBtn.isVisible().catch(() => false)) { await cancelBtn.click(); await page.waitForTimeout(300); }

await page.getByPlaceholder('e.g., Pizza').fill('Pizza');
await page.getByPlaceholder('0.00').fill('20');
await page.getByRole('button', { name: 'Add Item' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Next' }).click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Alice', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Calculate Split' }).click();
await page.waitForTimeout(500);

// Go back to session, start Go Live
await page.getByRole('link', { name: /back to session/i }).click();
await page.waitForTimeout(500);
console.log('at session home:', page.url());
await page.screenshot({ path: '/tmp/live_home.png', fullPage: true });

const goLiveBtn = page.getByRole('button', { name: 'Go Live', exact: true });
if (await goLiveBtn.isVisible().catch(() => false)) {
  await goLiveBtn.click();
  await page.waitForTimeout(300);
  const startBtn = page.getByRole('button', { name: 'Start Live Session' });
  await startBtn.click();
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: '/tmp/live_started.png', fullPage: true });
console.log('errors so far:', JSON.stringify(errors));

// Navigate into the bill again
await page.goBack();
await page.waitForTimeout(500);
console.log('url:', page.url());
await page.screenshot({ path: '/tmp/live_bill_summary.png', fullPage: true });

const printBtn = page.getByRole('button', { name: /print bill/i });
console.log('printBtn visible:', await printBtn.isVisible().catch(() => false));
if (await printBtn.isVisible().catch(() => false)) {
  await printBtn.click();
}
await page.waitForTimeout(1000);
console.log('printEvents after click+1s:', printEvents.length);

// Now navigate (simulating "Back to Session") and see if print fires then
await page.getByRole('link', { name: /back to session/i }).click();
await page.waitForTimeout(1000);
console.log('printEvents after navigation:', printEvents.length);
console.log('URL now:', page.url());

await browser.close();
console.log(JSON.stringify({errors}, null, 2));
