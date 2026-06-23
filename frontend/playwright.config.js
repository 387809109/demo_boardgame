import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for scripted E2E regression tests.
 *
 * Scope: only what jsdom/node cannot verify — real SVG pointer hit-testing,
 * responsive layout, HMR/reload continuity, post-load UI re-render. Engine logic
 * and pure render contracts stay in the vitest suite (faster, no browser).
 *
 * `webServer` auto-starts the Vite dev server, so `npm run test:e2e` works with
 * no manual setup; locally it reuses an already-running dev server.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
