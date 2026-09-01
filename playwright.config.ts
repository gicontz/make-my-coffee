import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// E2E runs against its own throwaway database and its own dev server, never
// the developer's .env.local — see e2e/helpers/db.ts for the guard that
// enforces it. Create .env.e2e from .env.e2e.example first.
dotenv.config({ path: '.env.e2e' })

const PORT = Number(process.env.E2E_PORT || 3100)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Specs share one database, and several assert on exact voucher redemption
  // counts, so files must not interleave. Tests within a file still run in
  // declaration order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The server must see the *test* database and must not see live Gmail or
    // Lalamove credentials — an order-placing test would otherwise email real
    // people and call a real courier API. Both integrations already fail soft
    // (email is fire-and-forget, Lalamove falls back to the flat rate), so
    // simply withholding the credentials is enough to neutralise them.
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? '',
      ADMIN_USERNAME: process.env.E2E_ADMIN_USERNAME ?? 'admin',
      ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-password',
      SESSION_SECRET: process.env.E2E_SESSION_SECRET ?? 'e2e-session-secret',
      GMAIL_USER: '',
      GMAIL_APP_PASSWORD: '',
      ADMIN_EMAIL: '',
      BCC_EMAIL: '',
      LALAMOVE_API_KEY: '',
      LALAMOVE_SECRET_KEY: '',
      LALAMOVE_PICKUP_ADDRESS: '',
      LALAMOVE_PICKUP_LAT: '',
      LALAMOVE_PICKUP_LNG: '',
      NODE_ENV: 'development',
      PATH: process.env.PATH ?? '',
    },
  },
})
