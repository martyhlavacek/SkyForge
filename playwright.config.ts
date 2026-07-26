import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    launchOptions: executablePath
      ? { executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] }
      : undefined,
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: /device\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testMatch: /device\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-webkit',
      testMatch: /device\.spec\.ts/,
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'music-webkit',
      testMatch: /music\.spec\.ts/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: `VITE_E2E=1 "${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173`,
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
