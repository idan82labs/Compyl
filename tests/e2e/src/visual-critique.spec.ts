import { test } from "@playwright/test";
import * as path from "path";

const SCREENSHOT_DIR = path.resolve(__dirname, "../screenshots");

// Landing page
test("screenshot: landing page desktop", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/landing-desktop.png`, fullPage: true });
});

test("screenshot: landing page mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/landing-mobile.png`, fullPage: true });
});

// Login
test("screenshot: login page", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/login.png`, fullPage: true });
});

// Triage workspace (uses E2E mock route)
test("screenshot: triage workspace with bundles", async ({ page }) => {
  await page.goto("/e2e/triage");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/triage-workspace.png`, fullPage: true });
});

// Reporter session
test("screenshot: reporter session with bundles", async ({ page }) => {
  await page.goto("/session/test-session-1");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/reporter-session.png`, fullPage: true });
});

// Bundle detail
test("screenshot: bundle detail page", async ({ page }) => {
  await page.goto("/triage/test-bundle-1");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/bundle-detail.png`, fullPage: true });
});
