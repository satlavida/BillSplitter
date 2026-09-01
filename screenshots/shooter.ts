import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

// Every run's screenshots land under a directory named for today's date
// (not a run timestamp) — re-running on the same day overwrites that day's
// shots in place, which is what you want when iterating; a new day starts
// a fresh directory, so comparing two dates shows how a page changed.
function todayDirName(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// process.cwd()-relative rather than __dirname — this file is authored as
// CommonJS-shaped TS but the project itself is "type": "module" (see
// package.json), so __dirname isn't reliably available under every loader
// Playwright might pick. npm scripts always run from the repo root, so cwd
// is a safe anchor here.
export const OUTPUT_ROOT = path.resolve(process.cwd(), 'screenshots', 'output');

// One shooter per Playwright project (desktop/tablet/phone) — see
// playwright.screenshots.config.ts's project names — so each viewport's
// captures land in their own subdirectory under the same dated directory
// instead of colliding on filename when projects run in parallel.
export function createShooter(projectName: string) {
  const dir = path.join(OUTPUT_ROOT, todayDirName(), projectName);
  fs.mkdirSync(dir, { recursive: true });

  return async function shoot(page: Page, name: string): Promise<void> {
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
  };
}
