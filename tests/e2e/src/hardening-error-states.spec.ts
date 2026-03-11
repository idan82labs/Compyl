/**
 * E2E: Phase H hardening — error states, denied flows, transition cycles, boundary abuse.
 *
 * WHAT THIS PROVES:
 * - Triage workspace handles API errors gracefully (500, empty states)
 * - Reporter session handles server errors gracefully
 * - PATCH transition failures are surfaced to the developer
 * - Full status lifecycle works end-to-end (pending → approved → in_progress → resolved → reopen)
 * - Rejection flow works (pending → rejected → reopen for review)
 * - Reporter surface never renders provenance even if API response includes it (defense in depth)
 * - Multiple bundles with mixed statuses render correctly
 *
 * HOW: Uses page.route() to mock API responses with various error/edge-case payloads.
 */

import { test, expect } from "@playwright/test";

// =============================================================================
// Shared mock data
// =============================================================================

const MOCK_BUNDLE_BASE = {
  id: "bundle-h-001",
  title: "Hardening test bundle",
  summary: "A test bundle for Phase H hardening.",
  normalized_task: "Fix hardening test issue",
  category: "layout_issue",
  severity: "minor",
  page_url: "https://app.example.com/test",
  screenshot_url: null,
  dom_selector: ".test-el",
  exact_source: {
    file_path: "src/components/Test.tsx",
    component_name: "TestComponent",
    line: 10,
    line_kind: "leaf-dom",
  },
  resolved_component_stack: [
    {
      component_name: "TestComponent",
      file_path: "src/components/Test.tsx",
      line: 10,
      line_kind: "definition",
      is_library: false,
    },
  ],
  resolution_mode: "fiber_meta",
  missing_reasons: [],
  root_boundary_kind: null,
  component_candidates: [],
  design_candidates: [],
  acceptance_criteria: ["Test passes"],
  confidence: { component_match: 0.9, design_match: 0.0, task_clarity: 0.7 },
  status: "pending_review",
  assignee_type: "unassigned",
  assignee_id: null,
  created_at: "2026-03-11T10:00:00.000Z",
};

// =============================================================================
// Error state tests
// =============================================================================

test.describe("Error states — triage workspace", () => {
  test("API returning 500 shows error message", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Error message should be displayed
    await expect(page.locator("text=Failed to load bundles")).toBeVisible({ timeout: 5_000 });
  });

  test("API returning empty bundles array shows empty state", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bundles: [] }),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    await expect(page.locator("text=No bundles yet")).toBeVisible();
    await expect(page.locator("text=Submit a review session")).toBeVisible();
  });

  test("PATCH returning 422 surfaces transition error to developer", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ bundles: [MOCK_BUNDLE_BASE] }),
        });
      }
    });

    await page.route("**/api/v1/bundles/*", (route) => {
      if (route.request().method() === "PATCH") {
        route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Invalid status transition",
            current_status: "pending_review",
            requested_status: "resolved",
            allowed_transitions: ["approved", "rejected"],
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand and click Approve (which will be rejected by mock)
    await page.locator("text=Hardening test bundle").click();
    await page.locator("button", { hasText: "Approve" }).click();

    // Error message from API should be visible
    await expect(page.locator("text=Invalid status transition")).toBeVisible({ timeout: 5_000 });
  });

  test("PATCH returning 403 surfaces permission error to developer", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ bundles: [MOCK_BUNDLE_BASE] }),
        });
      }
    });

    await page.route("**/api/v1/bundles/*", (route) => {
      if (route.request().method() === "PATCH") {
        route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Agent resolution not enabled",
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    await page.locator("text=Hardening test bundle").click();
    await page.locator("button", { hasText: "Approve" }).click();

    await expect(page.locator("text=Agent resolution not enabled")).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Error states — reporter session", () => {
  test("API returning 500 shows error message", async ({ page }) => {
    await page.route("**/api/v1/sessions/session-error-500", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto("/session/session-error-500");

    // Should show generic error
    await expect(page.locator("text=Failed to load session")).toBeVisible({ timeout: 10_000 });
  });
});

// =============================================================================
// Full status transition cycle tests
// =============================================================================

test.describe("Full status lifecycle transitions", () => {
  test("complete lifecycle: pending → approved → in_progress → resolved → reopen", async ({ page }) => {
    let currentStatus = "pending_review";

    await page.route("**/api/v1/bundles", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            bundles: [{ ...MOCK_BUNDLE_BASE, status: currentStatus }],
          }),
        });
      }
    });

    await page.route("**/api/v1/bundles/*", (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON() as { status: string };
        currentStatus = body.status;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ bundle_id: MOCK_BUNDLE_BASE.id, updated: true }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Hardening test bundle").click();

    // Step 1: pending_review → approved (click Approve)
    await page.locator("button", { hasText: "Approve" }).click();
    await expect(page.locator("span", { hasText: "approved" }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("button", { hasText: "Start Work" })).toBeVisible();

    // Step 2: approved → in_progress (click Start Work)
    await page.locator("button", { hasText: "Start Work" }).click();
    await expect(page.locator("span", { hasText: "in progress" }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("button", { hasText: "Mark Resolved" })).toBeVisible();

    // Step 3: in_progress → resolved (click Mark Resolved)
    await page.locator("button", { hasText: "Mark Resolved" }).click();
    await expect(page.locator("span", { hasText: "resolved" }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("button", { hasText: "Reopen" })).toBeVisible();

    // Step 4: resolved → in_progress (click Reopen)
    await page.locator("button", { hasText: "Reopen" }).click();
    await expect(page.locator("span", { hasText: "in progress" }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("button", { hasText: "Mark Resolved" })).toBeVisible();
  });

  test("rejection flow: pending → rejected → reopen for review", async ({ page }) => {
    let currentStatus = "pending_review";

    await page.route("**/api/v1/bundles", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            bundles: [{ ...MOCK_BUNDLE_BASE, status: currentStatus }],
          }),
        });
      }
    });

    await page.route("**/api/v1/bundles/*", (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON() as { status: string };
        currentStatus = body.status;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ bundle_id: MOCK_BUNDLE_BASE.id, updated: true }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    await page.locator("text=Hardening test bundle").click();

    // Step 1: pending_review → rejected
    await page.locator("button", { hasText: "Reject" }).click();
    await expect(page.locator("span", { hasText: "rejected" }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("button", { hasText: "Reopen for Review" })).toBeVisible();

    // Step 2: rejected → pending_review
    await page.locator("button", { hasText: "Reopen for Review" }).click();
    await expect(page.locator("span", { hasText: "pending review" }).first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("button", { hasText: "Approve" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Reject" })).toBeVisible();
  });
});

// =============================================================================
// Boundary abuse — defense in depth
// =============================================================================

test.describe("Boundary abuse — reporter defense in depth", () => {
  test("reporter UI ignores provenance data even if API leaks it", async ({ page }) => {
    // Simulate a misconfigured API that returns provenance fields in a reporter response
    const leakySession = {
      session_id: "session-leak-test",
      project_id: "proj-1",
      status: "submitted",
      started_at: "2026-03-11T10:00:00.000Z",
      submitted_at: "2026-03-11T10:30:00.000Z",
      bundles: [
        {
          id: "bundle-leak-001",
          title: "Leaked bundle title",
          summary: "This bundle has leaked provenance.",
          category: "visual_bug",
          screenshot_url: null,
          client_raw_text: "Color is wrong",
          reference_images: [],
          status: "pending_review",
          created_at: "2026-03-11T10:31:00.000Z",
          // ====== LEAKED FIELDS (should NOT be rendered) ======
          exact_source: {
            file_path: "src/components/SECRET/LeakedComponent.tsx",
            component_name: "LeakedComponent",
            line: 42,
            line_kind: "leaf-dom",
          },
          resolved_component_stack: [
            {
              component_name: "LeakedComponent",
              file_path: "src/components/SECRET/LeakedComponent.tsx",
              line: 42,
            },
          ],
          severity: "critical",
          normalized_task: "Fix the leaked secret component",
          acceptance_criteria: ["SECRET acceptance criterion"],
          dom_selector: "#secret-selector",
          design_candidates: [
            { component_id: "x:1", component_name: "SecretFigma", confidence: 0.9 },
          ],
          design_diff: { "color": "#000000 → #FFFFFF" },
          confidence: { component_match: 0.99, design_match: 0.95, task_clarity: 0.8 },
        },
      ],
    };

    await page.route("**/api/v1/sessions/session-leak-test", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(leakySession),
      });
    });

    await page.goto("/session/session-leak-test");
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });

    // Reporter-safe content IS visible
    await expect(page.locator("text=Leaked bundle title")).toBeVisible();
    await expect(page.locator("text=Color is wrong")).toBeVisible();

    // Leaked provenance MUST NOT be rendered
    const bodyText = await page.locator("body").innerText();

    const mustNotContain = [
      "LeakedComponent",
      "src/components/SECRET",
      "SECRET acceptance criterion",
      "#secret-selector",
      "SecretFigma",
      "normalized_task",
      "Fix the leaked secret component",
      "Exact Source",
      "Component Stack",
      "Provenance",
      "Design Candidates",
      "Acceptance Criteria",
      "critical",  // severity
      "dom_selector",
      "design_diff",
    ];

    for (const forbidden of mustNotContain) {
      expect(bodyText, `LEAK: "${forbidden}" found in reporter DOM`).not.toContain(forbidden);
    }
  });
});

// =============================================================================
// Multiple bundles with mixed statuses
// =============================================================================

test.describe("Mixed-status bundle list", () => {
  test("multiple bundles with different statuses render with correct badges and actions", async ({ page }) => {
    const mixedBundles = {
      bundles: [
        { ...MOCK_BUNDLE_BASE, id: "b-1", title: "Pending bundle", status: "pending_review" },
        { ...MOCK_BUNDLE_BASE, id: "b-2", title: "Approved bundle", status: "approved" },
        { ...MOCK_BUNDLE_BASE, id: "b-3", title: "In-progress bundle", status: "in_progress" },
        { ...MOCK_BUNDLE_BASE, id: "b-4", title: "Resolved bundle", status: "resolved" },
        { ...MOCK_BUNDLE_BASE, id: "b-5", title: "Rejected bundle", status: "rejected" },
      ],
    };

    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mixedBundles),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // All 5 bundles visible
    await expect(page.locator("text=Pending bundle")).toBeVisible();
    await expect(page.locator("text=Approved bundle")).toBeVisible();
    await expect(page.locator("text=In-progress bundle")).toBeVisible();
    await expect(page.locator("text=Resolved bundle")).toBeVisible();
    await expect(page.locator("text=Rejected bundle")).toBeVisible();

    // Status badges visible (text appears in status badges)
    await expect(page.locator("span", { hasText: "pending review" }).first()).toBeVisible();
    await expect(page.locator("span", { hasText: "approved" }).first()).toBeVisible();
    await expect(page.locator("span", { hasText: "in progress" }).first()).toBeVisible();
    await expect(page.locator("span", { hasText: "resolved" }).first()).toBeVisible();
    await expect(page.locator("span", { hasText: "rejected" }).first()).toBeVisible();

    // Expand pending bundle — verify correct actions
    await page.locator("text=Pending bundle").click();
    await expect(page.locator("button").filter({ hasText: /^Approve$/ })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: /^Reject$/ })).toBeVisible();
  });
});

// =============================================================================
// Capability URL session edge cases
// =============================================================================

test.describe("Capability URL edge cases", () => {
  test("submitted session with bundles renders correctly", async ({ page }) => {
    const submittedSession = {
      session_id: "session-submitted-001",
      project_id: "proj-1",
      status: "submitted",
      started_at: "2026-03-11T10:00:00.000Z",
      submitted_at: "2026-03-11T10:30:00.000Z",
      bundles: [
        {
          id: "b-sub-1",
          title: "Submitted feedback item",
          summary: "An item in a submitted session.",
          category: "copy_change",
          screenshot_url: null,
          client_raw_text: "Fix the typo",
          reference_images: [],
          status: "approved",
          created_at: "2026-03-11T10:31:00.000Z",
        },
      ],
    };

    await page.route("**/api/v1/sessions/session-submitted-001", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(submittedSession),
      });
    });

    await page.goto("/session/session-submitted-001");
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("span", { hasText: "submitted" }).first()).toBeVisible();
    await expect(page.locator("text=Submitted feedback item")).toBeVisible();
    await expect(page.locator("text=Feedback Items (1)")).toBeVisible();
  });

  test("session with expired/invalid ID shows 404", async ({ page }) => {
    await page.route("**/api/v1/sessions/invalid-session-xyz", (route) => {
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Session not found" }),
      });
    });

    await page.goto("/session/invalid-session-xyz");
    await expect(page.locator("text=Session not found")).toBeVisible({ timeout: 10_000 });
  });

  test("active session shows no-feedback-yet state", async ({ page }) => {
    const activeSession = {
      session_id: "session-active-edge",
      project_id: "proj-1",
      status: "active",
      started_at: "2026-03-11T10:00:00.000Z",
      submitted_at: null,
      bundles: [],
    };

    await page.route("**/api/v1/sessions/session-active-edge", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeSession),
      });
    });

    await page.goto("/session/session-active-edge");
    await expect(page.locator("text=Review Session")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=No feedback items yet")).toBeVisible();
  });
});
