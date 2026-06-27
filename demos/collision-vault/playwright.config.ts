import { defineConfig, devices } from '@playwright/test';

// E2E + accessibility checks for the browser proof path. The webServer builds
// the site and serves it under the real Pages base path so asset URLs match
// production. Tests live in ./e2e (kept out of the Vitest unit suite).
const PORT = 4329;
const BASE = `http://localhost:${PORT}/crypto-lab-collision-vault/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } }
  ]
});
