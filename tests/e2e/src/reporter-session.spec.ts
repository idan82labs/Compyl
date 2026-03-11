/**
 * E2E: Reporter session review page.
 *
 * WHAT THIS PROVES (in a real browser):
 * - Reporter session page renders correctly from capability URL
 * - Only reporter-safe fields appear in the DOM (title, summary, category label, status)
 * - Provenance data (file paths, component stacks, severity, acceptance criteria)
 *   is NEVER present in the rendered HTML
 * - Error states render correctly (404 session, empty bundles)
 * - Category labels are human-readable (no raw enum values)
 *
 * HOW: Playwright navigates to /session/[id], intercepts API calls via page.route(),
 * returns mock session data, and verifies the rendered DOM content.
 *
 * No auth required — reporter sessions use capability URLs.
 * No live API required — API responses are mocked at the browser fetch level.
 */

import { test, expect } from "@playwright/test";

// =============================================================================
// Mock data — matches API response shapes exactly
// =============================================================================

const MOCK_SESSION_WITH_BUNDLES = {
  session_id: "session-e2e-001",
  project_id: "proj-e2e-001",
  status: "submitted",
  started_at: "2026-03-10T14:00:00.000Z",
  submitted_at: "2026-03-10T14:30:00.000Z",
  bundles: [
    {
      id: "bundle-e2e-001",
      title: "Button color does not match design",
      summary: "The submit button uses blue (#3B82F6) instead of the specified green (#10B981).",
      category: "visual_bug",
      screenshot_url: null,
      client_raw_text: "The button color is wrong, should be green",
      reference_images: [],
      status: "pending_review",
      created_at: "2026-03-10T14:31:00.000Z",
    },
    {
      id: "bundle-e2e-002",
      title: "Header text has a typo",
      summary: "The main heading contains 'Welcom' instead of 'Welcome'.",
      category: "copy_change",
      screenshot_url: null,
      client_raw_text: "There's a typo in the header",
      reference_images: [],
      status: "approved",
      created_at: "2026-03-10T14:32:00.000Z",
    },
  ],
};

const MOCK_SESSION_EMPTY = {
  session_id: "session-e2e-002",
  project_id: "proj-e2e-001",
  status: "submitted",
  started_at: "2026-03-10T15:00:00.000Z",
  submitted_at: "2026-03-10T15:05:00.000Z",
  bundles: [],
};

const MOCK_SESSION_ACTIVE = {
  session_id: "session-e2e-003",
  project_id: "proj-e2e-001",
  status: "active",
  started_at: "2026-03-10T16:00:00.000Z",
  submitted_at: null,
  bundles: [],
};

/**
 * Provenance data that MUST NEVER appear in the reporter DOM.
 * These are values a developer bundle would contain.
 */
const FORBIDDEN_PROVENANCE_STRINGS = [
  // File paths (specific patterns)
  "src/components/",
  "src/App.tsx",
  // Component stack terms
  "resolved_component_stack",
  "exact_source",
  "resolution_mode",
  "fiber_meta",
  "leaf_only",
  "server_prefix",
  // Developer-only field names
  "missing_reasons",
  "root_boundary_kind",
  "normalized_task",
  "acceptance_criteria",
  "Acceptance Criteria",
  "dom_selector",
  "computed_styles",
  "component_candidates",
  "design_candidates",
  "design_diff",
  "validation_steps",
  "unresolved_ambiguities",
  // Provenance UI labels
  "Exact Source",
  "Component Stack",
  "Provenance",
];

// =============================================================================
// Tests
// =============================================================================

test.describe("Reporter session page", () => {
  test("renders bundles from mocked API with semantic-only content", async ({ page }) => {
    // Intercept API call
    await page.route("**/api/v1/sessions/session-e2e-001", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION_WITH_BUNDLES),
      });
    });

    await page.goto("/session/session-e2e-001");

    // Wait for content to render (loading state disappears)
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });

    // Session header
    await expect(page.locator("text=submitted")).toBeVisible();

    // Bundle titles
    await expect(page.locator("text=Button color does not match design")).toBeVisible();
    await expect(page.locator("text=Header text has a typo")).toBeVisible();

    // Bundle summaries
    await expect(page.locator("text=submit button uses blue")).toBeVisible();
    await expect(page.locator("text=main heading contains")).toBeVisible();

    // Category labels (human-readable, NOT raw enums)
    await expect(page.locator("text=Visual Issue")).toBeVisible();
    await expect(page.locator("text=Text Change")).toBeVisible();

    // Status labels
    await expect(page.locator("text=Pending Review")).toBeVisible();
    await expect(page.locator("text=Approved")).toBeVisible();

    // Raw feedback text
    await expect(page.locator("text=The button color is wrong, should be green")).toBeVisible();

    // Bundle count
    await expect(page.locator("text=Feedback Items (2)")).toBeVisible();
  });

  test("DOM contains zero provenance or developer-only data", async ({ page }) => {
    await page.route("**/api/v1/sessions/session-e2e-001", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION_WITH_BUNDLES),
      });
    });

    await page.goto("/session/session-e2e-001");
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });

    // Get visible text only (excludes script/RSC payloads via innerText)
    const bodyText = await page.locator("body").innerText();

    // None of the forbidden strings should appear in the DOM
    for (const forbidden of FORBIDDEN_PROVENANCE_STRINGS) {
      expect(bodyText, `LEAK: "${forbidden}" found in reporter DOM`).not.toContain(forbidden);
    }
  });

  test("handles 404 session gracefully", async ({ page }) => {
    await page.route("**/api/v1/sessions/nonexistent-session", (route) => {
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Session not found" }),
      });
    });

    await page.goto("/session/nonexistent-session");

    // Should show error state
    await expect(page.locator("text=Session not found")).toBeVisible({ timeout: 10_000 });
  });

  test("shows empty state when session has no bundles (submitted)", async ({ page }) => {
    await page.route("**/api/v1/sessions/session-e2e-002", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION_EMPTY),
      });
    });

    await page.goto("/session/session-e2e-002");
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });

    // Should show "Processing feedback" empty state for submitted sessions
    await expect(page.locator("text=Processing feedback")).toBeVisible();
    await expect(page.locator("text=being analyzed")).toBeVisible();
  });

  test("shows active empty state before submission", async ({ page }) => {
    await page.route("**/api/v1/sessions/session-e2e-003", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION_ACTIVE),
      });
    });

    await page.goto("/session/session-e2e-003");
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });

    // Should show "No feedback items yet" for active sessions
    await expect(page.locator("text=No feedback items yet")).toBeVisible();
  });

  test("raw category enum values never shown (human-readable labels only)", async ({ page }) => {
    await page.route("**/api/v1/sessions/session-e2e-001", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION_WITH_BUNDLES),
      });
    });

    await page.goto("/session/session-e2e-001");
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });

    const bodyText = await page.locator("body").textContent();

    // Raw category enum values should NOT appear (they should be human-readable labels)
    // Note: only checking category enums that have underscores (unambiguous signal)
    const rawEnums = [
      "visual_bug",
      "layout_issue",
      "copy_change",
      "feature_request",
      "behavior_bug",
      "pending_review",
    ];

    for (const raw of rawEnums) {
      expect(bodyText, `Raw enum "${raw}" should be a human-readable label`).not.toContain(raw);
    }
  });
});
