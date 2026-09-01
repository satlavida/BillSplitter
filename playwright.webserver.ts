import type { PlaywrightTestConfig } from '@playwright/test';

// Shared webServer bootstrapping (Vite dev server + the Go live-collaboration
// backend) — extracted so both playwright.config.ts (assertion-based e2e
// specs) and playwright.screenshots.config.ts (visual capture, see
// screenshots/README.md) boot the exact same servers/ports rather than two
// configs drifting out of sync.
export const webServer: PlaywrightTestConfig['webServer'] = [
  {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  {
    // liveApi.ts's default VITE_LIVE_SERVER_URL fallback ('http://localhost:8080')
    // already matches this port, so no Vite env override is needed for the
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
];
