import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
  },
  webServer: process.env.WEB_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: WEB_URL,
        reuseExistingServer: true,
        env: { VITE_API_URL: API_URL },
      },
});
