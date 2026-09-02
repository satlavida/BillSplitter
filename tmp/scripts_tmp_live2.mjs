// Ad-hoc manual repro script (not part of the Jest/Playwright suites) — the
// same Print-on-navigation investigation as scripts_tmp_live.mjs, but
// through the "Scan New Bill" path (attaches /tmp/test_receipt.png) instead
// of manually adding an item, to check whether a scanned receipt changes
// the same print-timing behavior around Go Live / back-navigation.
//
// Run manually against a dev server already running on :5173
// (`npm run dev`), with a receipt image at /tmp/test_receipt.png:
// `node tmp/scripts_tmp_live2.mjs`. Screenshots land in /tmp/*.png. Not run
// in CI or npm test/e2e.
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

// Use Scan New Bill with a file to attach a receipt image
const scanBtn = page.getByRole('button', { name: /scan new bill/i });
await scanBtn.click();
await page.waitForTimeout(300);
const fileInput = page.locator('input[type=file]');
await fileInput.setInputFiles('/tmp/test_receipt.png');
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Process Receipt' }).click();
await page.waitForTimeout(1000);
console.log('after scan url:', page.url());
await page.screenshot({ path: '/tmp/after_scan.png', fullPage: true });

// Add item manually (scan likely fails without real API key, but item still needed)
const nameInput = page.getByPlaceholder('e.g., Pizza');
if (await nameInput.isVisible().catch(() => false)) {
  await nameInput.fill('Pizza');
  await page.getByPlaceholder('0.00').fill('20');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Calculate Split' }).click();
  await page.waitForTimeout(500);
}
console.log('step3 url:', page.url());
await page.screenshot({ path: '/tmp/step3_with_receipt.png', fullPage: true });

// Go Live
await page.getByRole('link', { name: /back to session/i }).click();
await page.waitForTimeout(500);
const goLiveBtn = page.getByRole('button', { name: 'Go Live', exact: true });
if (await goLiveBtn.isVisible().catch(() => false)) {
  await goLiveBtn.click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Start Live Session' }).click();
  await page.waitForTimeout(1500);
}

await page.goBack();
await page.waitForTimeout(800);
console.log('url now:', page.url());
await page.screenshot({ path: '/tmp/final_step3.png', fullPage: true });

const printBtn = page.getByRole('button', { name: /print bill/i });
console.log('printBtn visible:', await printBtn.isVisible().catch(() => false));
if (await printBtn.isVisible().catch(() => false)) {
  await printBtn.click();
}
await page.waitForTimeout(1500);
console.log('printEvents after click+1.5s:', printEvents.length);

await page.getByRole('link', { name: /back to session/i }).click();
await page.waitForTimeout(1000);
console.log('printEvents after navigation:', printEvents.length);

await browser.close();
console.log(JSON.stringify({errors}, null, 2));
