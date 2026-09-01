import { defineConfig, devices } from '@playwright/test';
import { webServer } from './playwright.webserver';

// Visual-capture run, separate from the assertion-based e2e suite
// (playwright.config.ts) — see screenshots/README.md. Boots the same
// Vite/Go servers (via the shared webServer array) but points testDir at
// screenshots/ instead of e2e/, so `npm run screenshots` never picks up
// the regular e2e specs and `npm run e2e` never picks up capture.spec.ts.
export default defineConfig({
  testDir: './screenshots',
  fullyParallel: true,
  // One test walks ~13 pages plus a live-session join round trip — needs
  // more headroom than the assertion-focused e2e specs. capture.spec.ts
  // also calls test.slow() (3x this) for extra margin on a cold dev-server
  // start.
  timeout: 120000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    // Same onboarding-skip storageState as playwright.config.ts — see its
    // comment for why (OnboardingModal would otherwise block the very
    // first page load in every fresh project's browser context).
    storageState: './e2e/.setup/onboarding-completed.json',
  },
  // Desktop/tablet/phone — one project per size, matching the app's own
  // `md` (768px) breakpoint (see src/hooks/useIsMobile.ts) so the tablet
  // capture actually exercises the mobile sidebar/right-panel behavior at
  // the boundary rather than a size that's ambiguously "desktop" already.
  // Deliberately Chromium (`devices['Desktop Chrome']`) for all three,
  // just with different viewports/touch metrics, rather than the WebKit-
  // based `devices['iPad ...']`/`devices['iPhone ...']` presets — this repo
  // only installs the Chromium browser (see playwright.config.ts's single
  // 'chromium' project), so pulling in real WebKit would mean an extra
  // `npx playwright install webkit` most people running this don't have.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 810, height: 1080 }, isMobile: true, hasTouch: true } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer,
});
