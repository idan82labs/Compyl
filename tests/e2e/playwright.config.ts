import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm --filter @compyl/web dev",
    port: 3000,
    timeout: 30_000,
    reuseExistingServer: !process.env["CI"],
    env: {
      AUTH_SECRET: "e2e-test-secret-must-be-at-least-32-chars",
      AUTH_TRUST_HOST: "true",
    },
  },
});
