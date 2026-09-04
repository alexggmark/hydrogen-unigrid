import {defineConfig, devices} from '@playwright/test';

// visual regression is the point. every css bug this project has produced —
// a clipped panel, a silently invalid property, a stacking change — passed
// typecheck, lint and every unit test.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  expect: {
    // font rasterising differs between machines, so an exact match would fail
    // everywhere but the machine that recorded it
    toHaveScreenshot: {maxDiffPixelRatio: 0.01, animations: 'disabled'},
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
  webServer: {
    command: 'npm run dev --workspace storefront',
    url: 'http://localhost:3000/grid',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
