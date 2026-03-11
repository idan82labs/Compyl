/**
 * E2E: Developer triage workspace.
 *
 * WHAT THIS PROVES (in a real browser):
 * - Triage page renders ExecutionBundles with full provenance
 * - exact_source and resolved_component_stack are displayed SEPARATELY
 * - Resolution mode badge is visible
 * - Missing reasons shown when provenance is incomplete
 * - Severity, normalized_task, acceptance_criteria visible (developer-only fields)
 * - Expanding a bundle row reveals provenance section
 * - Degraded mode: empty provenance displays honestly with missing_reasons
 *
 * HOW: Uses /e2e/triage (test-mode page that skips auth) with mocked API responses.
 *
 * WHAT THIS DOES NOT PROVE:
 * - Auth.js login flow (deferred — requires live API for credential verification)
 * - Real database queries (mock API responses)
 */

import { test, expect } from "@playwright/test";

// =============================================================================
// Mock data — developer bundle with full provenance
// =============================================================================

const MOCK_BUNDLE_WITH_PROVENANCE = {
  bundles: [
    {
      id: "bundle-dev-001",
      title: "Submit button misaligned on mobile",
      summary: "The submit button extends beyond the viewport on screens < 375px.",
      normalized_task: "Fix submit button overflow on mobile viewport",
      category: "layout_issue",
      severity: "major",
      page_url: "https://app.example.com/checkout",
      screenshot_url: null,
      dom_selector: "#checkout-submit",

      // Provenance — SEPARATE fields
      exact_source: {
        file_path: "src/components/Checkout/SubmitButton.tsx",
        component_name: "SubmitButton",
        line: 42,
        line_kind: "leaf-dom",
      },
      resolved_component_stack: [
        {
          component_name: "SubmitButton",
          file_path: "src/components/Checkout/SubmitButton.tsx",
          line: 42,
          line_kind: "definition",
          is_library: false,
        },
        {
          component_name: "CheckoutForm",
          file_path: "src/components/Checkout/CheckoutForm.tsx",
          line: 15,
          line_kind: "definition",
          is_library: false,
        },
        {
          component_name: "Dialog",
          file_path: "node_modules/@radix-ui/react-dialog/dist/index.mjs",
          line: 200,
          line_kind: "definition",
          is_library: true,
        },
      ],
      resolution_mode: "fiber_meta",
      missing_reasons: [],
      root_boundary_kind: null,

      component_candidates: [
        { component_name: "SubmitButton", file_path: "src/components/Checkout/SubmitButton.tsx", confidence: 0.95 },
      ],
      design_candidates: [
        {
          component_id: "1:42",
          component_name: "SubmitButton",
          confidence: 1.0,
          is_code_connect: true,
          ranking_signals: [
            { signal: "code_connect", weight: 1.0, matched: true, detail: "Code Connect identity resolution via exact_source: SubmitButton → SubmitButton" },
          ],
        },
        {
          component_id: "1:99",
          component_name: "ActionButton",
          confidence: 0.45,
          is_code_connect: false,
          ranking_signals: [
            { signal: "visible_text", weight: 0.3, matched: true, detail: "Text similarity 0.40 with \"ActionButton\"" },
            { signal: "dom_role", weight: 0.05, matched: true, detail: "DOM tag \"button\" correlates with \"ActionButton\"" },
          ],
        },
      ],
      acceptance_criteria: [
        "Button fits within viewport on 375px wide screen",
        "No horizontal scroll appears on mobile",
      ],
      confidence: { component_match: 0.95, design_match: 0.8, task_clarity: 0.8 },
      status: "pending_review",
      assignee_type: "unassigned",
      assignee_id: null,
      created_at: "2026-03-10T14:31:00.000Z",
    },
  ],
};

// =============================================================================
// Mock data — agent activity (MCP + CLI events)
// =============================================================================

const MOCK_ACTIVITY_MCP_CLI = {
  actions: [
    {
      id: "act-mcp-001",
      timestamp: "2026-03-10T16:00:00.000Z",
      actor_type: "agent",
      actor_id: "agent-token-001",
      source: "mcp",
      action: "get_bundle",
      payload: { bundle_id: "bundle-dev-001" },
      target_entity_type: "bundle",
      target_entity_id: "bundle-dev-001",
      status: "success",
      duration_ms: 42,
      request_id: "req-001",
      project_id: "e2e-test-project",
    },
    {
      id: "act-cli-001",
      timestamp: "2026-03-10T15:30:00.000Z",
      actor_type: "human",
      actor_id: "user-42",
      source: "cli",
      action: "pull",
      payload: { project_id: "e2e-test-project" },
      target_entity_type: "project",
      target_entity_id: "e2e-test-project",
      status: "success",
      duration_ms: 120,
      session_id: "sess-001",
      project_id: "e2e-test-project",
    },
    {
      id: "act-mcp-002",
      timestamp: "2026-03-10T15:00:00.000Z",
      actor_type: "agent",
      actor_id: "agent-token-001",
      source: "mcp",
      action: "update_bundle_status",
      payload: { bundle_id: "bundle-dev-001", status: "approved" },
      target_entity_type: "bundle",
      target_entity_id: "bundle-dev-001",
      status: "error",
      error_code: "NOT_FOUND",
      error_message: "Bundle not found",
      duration_ms: 5,
      request_id: "req-002",
      project_id: "e2e-test-project",
    },
  ],
  total: 3,
  limit: 50,
  offset: 0,
};

const MOCK_ACTIVITY_EMPTY = {
  actions: [],
  total: 0,
  limit: 50,
  offset: 0,
};

const MOCK_BUNDLE_DEGRADED = {
  bundles: [
    {
      id: "bundle-dev-002",
      title: "Font size too small on dashboard",
      summary: "Body text on dashboard widgets uses 10px instead of minimum 14px.",
      normalized_task: "Increase dashboard widget font size to meet accessibility standards",
      category: "accessibility",
      severity: "minor",
      page_url: "https://app.example.com/dashboard",
      screenshot_url: null,
      dom_selector: ".widget-body",

      // Degraded provenance — no exact source, empty component stack
      exact_source: null,
      resolved_component_stack: [],
      resolution_mode: "leaf_only",
      missing_reasons: ["no_fiber_found", "no_data_rl_source"],
      root_boundary_kind: null,

      component_candidates: [],
      design_candidates: [],
      acceptance_criteria: ["Dashboard text meets WCAG AA minimum size (14px)"],
      confidence: { component_match: 0.0, design_match: 0.0, task_clarity: 0.6 },
      status: "pending_review",
      assignee_type: "unassigned",
      assignee_id: null,
      created_at: "2026-03-10T15:00:00.000Z",
    },
  ],
};

// =============================================================================
// Tests
// =============================================================================

test.describe("Developer triage workspace", () => {
  test("renders bundle with provenance sections displayed separately", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Bundle title and developer-only fields visible
    await expect(page.locator("text=Submit button misaligned on mobile")).toBeVisible();
    await expect(page.locator("text=major")).toBeVisible(); // severity (developer-only)
    await expect(page.locator("text=Fix submit button overflow")).toBeVisible(); // normalized_task

    // Expand the bundle
    await page.locator("text=Submit button misaligned on mobile").click();

    // Provenance section heading should appear (not the page description)
    await expect(page.getByRole("heading", { name: /Provenance/ })).toBeVisible();

    // Exact Source — displayed separately
    await expect(page.getByText("Exact Source")).toBeVisible();
    await expect(page.getByText("SubmitButton", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("src/components/Checkout/SubmitButton.tsx:42").first()).toBeVisible();

    // Component Stack — displayed separately
    await expect(page.locator("text=Component Stack (3 frames)")).toBeVisible();
    await expect(page.locator("text=CheckoutForm")).toBeVisible();
    await expect(page.locator("text=src/components/Checkout/CheckoutForm.tsx")).toBeVisible();

    // Library component marked
    await expect(page.locator("text=Dialog")).toBeVisible();
    await expect(page.locator("text=(lib)")).toBeVisible();

    // Resolution mode badge
    await expect(page.locator("text=Fiber + Meta")).toBeVisible();

    // Acceptance criteria (developer-only)
    await expect(page.locator("text=Acceptance Criteria")).toBeVisible();
    await expect(page.locator("text=Button fits within viewport")).toBeVisible();

    // Confidence scores
    await expect(page.getByText("95%").first()).toBeVisible(); // component_match
  });

  test("exact_source and resolved_component_stack are in separate DOM sections", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Submit button misaligned on mobile").click();

    // Both sections must exist as separate headings
    const exactSourceHeading = page.locator("text=Exact Source");
    const componentStackHeading = page.locator("text=Component Stack");

    await expect(exactSourceHeading).toBeVisible();
    await expect(componentStackHeading).toBeVisible();

    // They must be different elements (separate sections)
    const exactSourceBox = await exactSourceHeading.boundingBox();
    const componentStackBox = await componentStackHeading.boundingBox();

    expect(exactSourceBox).toBeTruthy();
    expect(componentStackBox).toBeTruthy();

    // Component Stack section should be below Exact Source section
    expect(componentStackBox!.y).toBeGreaterThan(exactSourceBox!.y);
  });

  test("degraded provenance displays honestly with missing_reasons", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_DEGRADED),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Font size too small on dashboard").click();

    // Resolution mode should show "Leaf Only" (degraded)
    await expect(page.locator("text=Leaf Only")).toBeVisible();

    // Exact Source should show "Not available" with reasons
    await expect(page.locator("text=Not available")).toBeVisible();
    await expect(page.locator("text=no_fiber_found")).toBeVisible();
    await expect(page.locator("text=no_data_rl_source")).toBeVisible();

    // Component Stack should show empty state
    await expect(page.locator("text=Component Stack (0 frames)")).toBeVisible();
    await expect(page.locator("text=No component stack resolved")).toBeVisible();
  });

  test("developer view contains fields that reporter view must not", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle to reveal all developer fields
    await page.locator("text=Submit button misaligned on mobile").click();

    const bodyText = await page.locator("body").innerText();

    // Developer-only fields MUST be present (CSS uppercase means innerText is uppercase)
    const bodyLower = bodyText.toLowerCase();
    const developerOnlyStrings = [
      "provenance",
      "exact source",
      "component stack",
      "acceptance criteria",
      "submitbutton",               // component name
      "src/components/checkout",    // file path
      "fiber + meta",              // resolution mode
      "major",                     // severity
      "#checkout-submit",          // dom_selector
    ];

    for (const devField of developerOnlyStrings) {
      expect(bodyLower, `Developer field "${devField}" should be visible`).toContain(devField);
    }
  });
});

// =============================================================================
// Design Candidates tests (developer-only, Figma integration)
// =============================================================================

test.describe("Design Candidates in developer triage", () => {
  test("Code Connect candidate shows badge and 100% confidence", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Submit button misaligned on mobile").click();

    // Design Candidates section should be visible
    await expect(page.locator("text=Design Candidates")).toBeVisible();
    await expect(page.locator("text=Figma component matches")).toBeVisible();

    // Code Connect candidate with badge
    await expect(page.locator("text=Code Connect")).toBeVisible();
    await expect(page.locator("text=100%").first()).toBeVisible();
  });

  test("expanding a candidate shows ranking signals", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Submit button misaligned on mobile").click();

    // Expand the second candidate (ActionButton — non-Code-Connect)
    await page.locator("text=ActionButton").click();

    // Ranking signals should be visible
    await expect(page.locator("text=Ranking Signals")).toBeVisible();
    await expect(page.locator("text=visible_text")).toBeVisible();
    await expect(page.locator("text=dom_role")).toBeVisible();
  });

  test("degraded bundle shows no Design Candidates section", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_DEGRADED),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Font size too small on dashboard").click();

    // Design Candidates section should NOT be visible (empty array)
    await expect(page.locator("text=Design Candidates")).not.toBeVisible();
  });

  test("reporter surface does NOT show design candidates", async ({ page }) => {
    const sessionData = {
      session_id: "session-design-check",
      project_id: "proj-1",
      status: "submitted",
      started_at: "2026-03-10T14:00:00.000Z",
      submitted_at: "2026-03-10T14:30:00.000Z",
      bundles: [],
    };

    await page.route("**/api/v1/sessions/*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessionData) });
    });

    await page.goto("/session/session-design-check");

    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });

    const bodyText = await page.locator("body").innerText();
    const bodyLower = bodyText.toLowerCase();

    // Reporter must NOT see design candidates, Code Connect, or Figma details
    expect(bodyLower).not.toContain("design candidates");
    expect(bodyLower).not.toContain("code connect");
    expect(bodyLower).not.toContain("figma");
    expect(bodyLower).not.toContain("ranking signals");
  });
});

// =============================================================================
// Before/After Comparison tests (developer-only)
// =============================================================================

const MOCK_BUNDLE_WITH_SCREENSHOT = {
  bundles: [
    {
      ...MOCK_BUNDLE_WITH_PROVENANCE.bundles[0],
      id: "bundle-screenshot-001",
      screenshot_url: "https://cdn.example.com/screenshots/checkout-submit.png",
      design_diff: { "padding-left": "8px → 16px", "font-size": "14px → 16px" },
    },
  ],
};

test.describe("Before/After Comparison in developer triage", () => {
  test("shows comparison panel with screenshot and design reference", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_WITH_SCREENSHOT),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Submit button misaligned on mobile").click();

    // Before/After section should be visible
    await expect(page.locator("text=Before / After Comparison")).toBeVisible();
    await expect(page.locator("text=Current (Before)")).toBeVisible();
    await expect(page.locator("text=Design Reference (After)")).toBeVisible();

    // Screenshot should be present
    const img = page.locator("img[alt='Current implementation screenshot']");
    await expect(img).toBeVisible();

    // Design diff should show style differences
    await expect(page.locator("text=Style Differences")).toBeVisible();
    await expect(page.locator("text=padding-left:")).toBeVisible();
    await expect(page.locator("text=font-size:")).toBeVisible();
  });

  test("shows placeholder when no screenshot and low confidence match", async ({ page }) => {
    const lowConfBundle = {
      bundles: [{
        ...MOCK_BUNDLE_DEGRADED.bundles[0],
        screenshot_url: null,
        design_candidates: [
          { component_id: "x:1", component_name: "Widget", confidence: 0.2, is_code_connect: false },
        ],
        design_diff: null,
      }],
    };

    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(lowConfBundle),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    await page.locator("text=Font size too small on dashboard").click();

    // Should NOT show Before/After when no screenshot AND no design_diff
    // (the component only renders when screenshot_url or design_diff exists)
    await expect(page.locator("text=Before / After Comparison")).not.toBeVisible();
  });

  test("reporter surface does NOT show before/after comparison", async ({ page }) => {
    const sessionData = {
      session_id: "session-beforeafter-check",
      project_id: "proj-1",
      status: "submitted",
      started_at: "2026-03-10T14:00:00.000Z",
      submitted_at: "2026-03-10T14:30:00.000Z",
      bundles: [],
    };

    await page.route("**/api/v1/sessions/*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessionData) });
    });

    await page.goto("/session/session-beforeafter-check");
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });

    const bodyText = await page.locator("body").innerText();
    const bodyLower = bodyText.toLowerCase();

    expect(bodyLower).not.toContain("before / after");
    expect(bodyLower).not.toContain("design reference");
    expect(bodyLower).not.toContain("style differences");
  });
});

// =============================================================================
// Curation Gate tests (developer-only, status transitions)
// =============================================================================

test.describe("Curation Gate in developer triage", () => {
  test("pending_review bundle shows Approve and Reject actions", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Submit button misaligned on mobile").click();

    // Curation actions should be visible
    await expect(page.locator("text=Actions:")).toBeVisible();
    await expect(page.locator("button", { hasText: "Approve" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Reject" })).toBeVisible();

    // Should NOT show Start Work or Mark Resolved (wrong state)
    await expect(page.locator("button", { hasText: "Start Work" })).not.toBeVisible();
    await expect(page.locator("button", { hasText: "Mark Resolved" })).not.toBeVisible();
  });

  test("clicking Approve transitions to approved status", async ({ page }) => {
    let patchCalled = false;
    let patchBody: Record<string, unknown> | null = null;

    await page.route("**/api/v1/bundles", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE),
        });
      }
    });

    await page.route("**/api/v1/bundles/*", (route) => {
      if (route.request().method() === "PATCH") {
        patchCalled = true;
        patchBody = route.request().postDataJSON() as Record<string, unknown>;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ bundle_id: "bundle-dev-001", updated: true }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle and click Approve
    await page.locator("text=Submit button misaligned on mobile").click();
    await page.locator("button", { hasText: "Approve" }).click();

    // Wait for status badge to update
    await expect(page.locator("span", { hasText: "approved" }).first()).toBeVisible({ timeout: 5_000 });

    // After approval, Start Work button should appear
    await expect(page.locator("button", { hasText: "Start Work" })).toBeVisible();

    // The Approve action button should no longer be visible (use exact text match)
    // Note: "approved" status badge may still contain the word, so check action buttons specifically
    const approveActionBtn = page.locator("button").filter({ hasText: /^Approve$/ });
    await expect(approveActionBtn).not.toBeVisible();

    expect(patchCalled).toBeTruthy();
    expect(patchBody).toEqual({ status: "approved" });
  });

  test("approved bundle shows Start Work and Return to Review", async ({ page }) => {
    const approvedBundle = {
      bundles: [{
        ...MOCK_BUNDLE_WITH_PROVENANCE.bundles[0],
        status: "approved",
      }],
    };

    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(approvedBundle),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Expand bundle
    await page.locator("text=Submit button misaligned on mobile").click();

    await expect(page.locator("button", { hasText: "Start Work" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Return to Review" })).toBeVisible();
  });

  test("in_progress bundle shows Mark Resolved and Unblock", async ({ page }) => {
    const inProgressBundle = {
      bundles: [{
        ...MOCK_BUNDLE_WITH_PROVENANCE.bundles[0],
        status: "in_progress",
      }],
    };

    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(inProgressBundle),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    await page.locator("text=Submit button misaligned on mobile").click();

    await expect(page.locator("button", { hasText: "Mark Resolved" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Unblock" })).toBeVisible();
  });

  test("resolved bundle shows Reopen action only", async ({ page }) => {
    const resolvedBundle = {
      bundles: [{
        ...MOCK_BUNDLE_WITH_PROVENANCE.bundles[0],
        status: "resolved",
      }],
    };

    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(resolvedBundle),
      });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    await page.locator("text=Submit button misaligned on mobile").click();

    await expect(page.locator("button", { hasText: "Reopen" })).toBeVisible();
    // Only one action for resolved
    await expect(page.locator("button", { hasText: "Approve" })).not.toBeVisible();
    await expect(page.locator("button", { hasText: "Mark Resolved" })).not.toBeVisible();
  });

  test("reporter surface does NOT show curation controls", async ({ page }) => {
    const sessionData = {
      session_id: "session-curation-check",
      project_id: "proj-1",
      status: "submitted",
      started_at: "2026-03-10T14:00:00.000Z",
      submitted_at: "2026-03-10T14:30:00.000Z",
      bundles: [],
    };

    await page.route("**/api/v1/sessions/*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessionData) });
    });

    await page.goto("/session/session-curation-check");
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });

    const bodyText = await page.locator("body").innerText();
    const bodyLower = bodyText.toLowerCase();

    // Reporter must NOT see curation controls
    expect(bodyLower).not.toContain("approve");
    expect(bodyLower).not.toContain("reject");
    expect(bodyLower).not.toContain("start work");
    expect(bodyLower).not.toContain("mark resolved");
    expect(bodyLower).not.toContain("curation");
  });
});

// =============================================================================
// Agent Activity tab tests
// =============================================================================

test.describe("Agent Activity tab", () => {
  test("renders MCP and CLI events with correct badges", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bundles: [] }) });
    });
    await page.route("**/api/v1/projects/*/activity*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ACTIVITY_MCP_CLI) });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Switch to Activity tab
    await page.locator("button", { hasText: "Activity" }).click();

    // MCP event visible
    await expect(page.locator("text=get_bundle")).toBeVisible();
    await expect(page.locator("span", { hasText: "mcp" }).first()).toBeVisible();

    // CLI event visible
    await expect(page.locator("text=pull")).toBeVisible();
    await expect(page.locator("span", { hasText: "cli" }).first()).toBeVisible();

    // Status badges
    await expect(page.locator("span", { hasText: "success" }).first()).toBeVisible();
    await expect(page.locator("span", { hasText: "error" }).first()).toBeVisible();

    // Duration shown
    await expect(page.locator("text=42ms")).toBeVisible();
    await expect(page.locator("text=120ms")).toBeVisible();
  });

  test("activity tab shows empty state when no events", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bundles: [] }) });
    });
    await page.route("**/api/v1/projects/*/activity*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ACTIVITY_EMPTY) });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Switch to Activity tab
    await page.locator("button", { hasText: "Activity" }).click();

    // Empty state message
    await expect(page.locator("text=No agent activity")).toBeVisible();
    await expect(page.locator("text=MCP tools and CLI commands")).toBeVisible();
  });

  test("expanding an action row shows payload and correlation IDs", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bundles: [] }) });
    });
    await page.route("**/api/v1/projects/*/activity*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ACTIVITY_MCP_CLI) });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Switch to Activity tab
    await page.locator("button", { hasText: "Activity" }).click();

    // Click on the MCP get_bundle event to expand
    await page.locator("text=get_bundle").click();

    // Actor info shown
    await expect(page.getByText("Agent (agent-token-001)")).toBeVisible();

    // Request ID shown
    await expect(page.locator("text=req-001")).toBeVisible();

    // Payload shown inside <pre> tag
    await expect(page.locator("text=Payload")).toBeVisible();
    await expect(page.locator("pre", { hasText: "bundle_id" })).toBeVisible();
  });

  test("error action row shows error details", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bundles: [] }) });
    });
    await page.route("**/api/v1/projects/*/activity*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ACTIVITY_MCP_CLI) });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Switch to Activity tab
    await page.locator("button", { hasText: "Activity" }).click();

    // Expand the error event (update_bundle_status)
    await page.locator("text=update_bundle_status").click();

    // Error details visible
    await expect(page.locator("text=NOT_FOUND")).toBeVisible();
    await expect(page.locator("text=Bundle not found")).toBeVisible();
  });

  test("bundles tab is default and still works after activity tab exists", async ({ page }) => {
    await page.route("**/api/v1/bundles", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_BUNDLE_WITH_PROVENANCE) });
    });

    await page.goto("/e2e/triage");
    await expect(page.locator("text=Triage Workspace")).toBeVisible({ timeout: 10_000 });

    // Bundles tab is active by default — bundles should be visible
    await expect(page.locator("text=Submit button misaligned on mobile")).toBeVisible();

    // Tab buttons exist
    await expect(page.locator("button", { hasText: "Bundles" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Activity" })).toBeVisible();
  });

  test("reporter surface is NOT affected by Activity tab presence", async ({ page }) => {
    // Reporter page should NOT have any Activity tab
    const sessionData = {
      session_id: "session-activity-check",
      project_id: "proj-1",
      status: "submitted",
      started_at: "2026-03-10T14:00:00.000Z",
      submitted_at: "2026-03-10T14:30:00.000Z",
      bundles: [],
    };

    await page.route("**/api/v1/sessions/*", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sessionData) });
    });

    await page.goto("/session/session-activity-check");

    // Wait for session page to render
    await expect(page.locator("body")).toBeVisible({ timeout: 10_000 });

    const bodyText = await page.locator("body").innerText();
    const bodyLower = bodyText.toLowerCase();

    // Reporter surface must NOT contain Activity tab or agent action data
    expect(bodyLower).not.toContain("activity");
    expect(bodyLower).not.toContain("agent");
    expect(bodyLower).not.toContain("mcp");
    expect(bodyLower).not.toContain("cli");
  });
});
