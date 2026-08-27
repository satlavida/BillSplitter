import { defineConfig, devices } from '@playwright/test';

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
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      // Go live-collaboration backend (server/). liveApi.ts's default
      // VITE_LIVE_SERVER_URL fallback ('http://localhost:8080') already
      // matches this port, so no Vite env override is needed for the
      // frontend to find it.
      command: 'go run ./cmd/server',
      cwd: './server',
      url: 'http://localhost:8080/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        PORT: '8080',
        DB_PATH: './data/e2e.db',
        IMAGE_DIR: './data/e2e-images',
      },
    },
  ],
});
