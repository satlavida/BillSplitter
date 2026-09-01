import { defineConfig, devices } from '@playwright/test';
import { webServer } from './playwright.webserver';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // Pre-seeds settingsStore's completedOnboarding flag so OnboardingModal
    // (src/Components/Prompts/OnboardingModal.tsx) doesn't pop up and block
    // the first interaction on every fresh test context — every spec here
    // starts from a blank profile, so without this every test would need to
    // dismiss the modal itself.
    storageState: './e2e/.setup/onboarding-completed.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer,
});
