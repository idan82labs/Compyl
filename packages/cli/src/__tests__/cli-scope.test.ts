/**
 * CLI token scope enforcement tests.
 *
 * WHAT THIS PROVES:
 * - Read-only tokens can execute read commands (pull, bundle, plan, diff)
 * - Read-only tokens are DENIED on mutating commands (status, push-result, validate)
 * - Denied commands produce audit events with status="denied" and error_code="SCOPE_DENIED"
 * - ReadWrite tokens can execute all commands
 * - No permission set → no enforcement
 *
 * HOW: Creates CommandContext with different permission levels, runs commands, checks outcomes.
 */

import type { ApiClient } from "@compyl/mcp-server";
import type { AgentAction, AgentDTO, AgentTokenPermission } from "@compyl/contracts";
import {
  pullCommand,
  bundleCommand,
  statusCommand,
  planCommand,
  pushResultCommand,
  validateCommand,
  diffCommand,
  type CommandContext,
} from "../commands.js";

// =============================================================================
// Test infrastructure
// =============================================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failed++;
    throw new Error(`FAIL: ${message}`);
  }
}

function pass(message: string): void {
  passed++;
  console.log(`PASS: ${message}`);
}

function makeMockBundle(id: string): AgentDTO {
  return {
    id,
    schema_version: "8",
    title: "Test",
    summary: "Test",
    normalized_task: "Fix",
    category: "visual_bug",
    severity: "major",
    page_url: "https://example.com",
    viewport: { width: 1920, height: 1080, scroll_x: 0, scroll_y: 0 },
    screenshot_url: "",
    annotation_coordinates: {},
    dom_selector: "#t",
    computed_styles: {},
    client_raw_text: "Test",
    reference_images: [],
    exact_source: null,
    resolved_component_stack: [],
    resolution_mode: "leaf_only",
    missing_reasons: [],
    root_boundary_kind: null,
    component_candidates: [],
    file_candidates: [],
    design_candidates: [],
    design_diff: null,
    branch: "main",
    commit_sha: "abc",
    build_url: null,
    acceptance_criteria: ["Test"],
    constraints: [],
    confidence: { component_match: 0, design_match: 0, task_clarity: 0 },
    unresolved_ambiguities: [],
    validation_steps: ["Check"],
    status: "pending_review",
    assignee_type: "unassigned",
    assignee_id: null,
    created_at: new Date().toISOString(),
    exported_to: [],
  };
}

function createScopedContext(permission?: AgentTokenPermission): { ctx: CommandContext; events: AgentAction[] } {
  const events: AgentAction[] = [];

  const api: ApiClient = {
    async listBundles() { return { bundles: [makeMockBundle("b1")], total: 1 }; },
    async getBundle(id) { return makeMockBundle(id); },
    async updateBundleStatus() { return { success: true }; },
    async assignBundle() { return { success: true }; },
    async proposeResolution() { return { success: true, proposal_id: "p1" }; },
    async getSession(id) { return { session_id: id, project_id: "p", status: "submitted", bundle_count: 1 }; },
    async listSessions() { return []; },
    async searchBundles() { return { bundles: [], total: 0 }; },
    async getAcceptanceCriteria(id) { return { bundle_id: id, acceptance_criteria: ["T"], validation_steps: ["S"] }; },
    async submitValidationResults() { return { success: true }; },
  };

  const ctx: CommandContext = {
    api,
    audit: (event) => events.push(event),
    actorId: "cli-scope-test",
    projectId: "proj-scope",
    permission,
  };

  return { ctx, events };
}

// =============================================================================
// Test 1: Read token allows read commands
// =============================================================================

async function testReadTokenAllowsReadCommands(): Promise<void> {
  const { ctx, events } = createScopedContext("read");

  await pullCommand(ctx, { project_id: "proj-1" });
  await bundleCommand(ctx, { bundle_id: "b-1" });
  await planCommand(ctx, { bundle_id: "b-1" });
  await diffCommand(ctx, { project_id: "proj-1", query: "test" });

  assert(events.length === 4, `Expected 4 events, got ${events.length}`);
  for (const event of events) {
    assert(event.status === "success", `Read command "${event.action}" should succeed, got "${event.status}"`);
    assert(event.source === "cli", `Source should be "cli"`);
  }

  pass("Read token allows all 4 read commands (pull, bundle, plan, diff)");
}

// =============================================================================
// Test 2: Read token denied on mutating commands
// =============================================================================

async function testReadTokenDeniedOnMutatingCommands(): Promise<void> {
  const { ctx, events } = createScopedContext("read");

  const mutatingCalls: Array<{ name: string; fn: () => Promise<unknown> }> = [
    { name: "status", fn: () => statusCommand(ctx, { bundle_id: "b-1", status: "approved" }) },
    { name: "push-result", fn: () => pushResultCommand(ctx, { bundle_id: "b-1", resolution_summary: "Fixed", files_changed: ["a.ts"] }) },
    { name: "validate", fn: () => validateCommand(ctx, { bundle_id: "b-1", validation_results: [{ step: "T", passed: true }] }) },
  ];

  for (const call of mutatingCalls) {
    let threw = false;
    try {
      await call.fn();
    } catch (err) {
      threw = true;
      const msg = (err as Error).message;
      assert(msg.includes("write permission") || msg.includes("scope"),
        `${call.name} error should mention scope, got: ${msg}`);
    }
    assert(threw, `${call.name} should throw for read-only token`);
  }

  // Verify denied audit events
  const deniedEvents = events.filter((e) => e.status === "denied");
  assert(deniedEvents.length === 3, `Expected 3 denied events, got ${deniedEvents.length}`);

  for (const event of deniedEvents) {
    assert(event.error_code === "SCOPE_DENIED", `Error code should be "SCOPE_DENIED", got "${event.error_code}"`);
    assert(event.source === "cli", `Source should be "cli", got "${event.source}"`);
  }

  pass("Read token denied on 3 mutating commands (status, push-result, validate) with audited denial");
}

// =============================================================================
// Test 3: ReadWrite token allows all commands
// =============================================================================

async function testReadWriteTokenAllowsAll(): Promise<void> {
  const { ctx, events } = createScopedContext("readwrite");

  // Read commands
  await pullCommand(ctx, { project_id: "proj-1" });
  await bundleCommand(ctx, { bundle_id: "b-1" });

  // Mutating commands
  await statusCommand(ctx, { bundle_id: "b-1", status: "approved" });
  await pushResultCommand(ctx, { bundle_id: "b-1", resolution_summary: "Fix", files_changed: ["x.ts"] });
  await validateCommand(ctx, { bundle_id: "b-1", validation_results: [{ step: "T", passed: true }] });

  assert(events.length === 5, `Expected 5 events, got ${events.length}`);
  const allSuccess = events.every((e) => e.status === "success");
  assert(allSuccess, "All events should be success for readwrite token");

  pass("ReadWrite token allows all commands (read + mutating)");
}

// =============================================================================
// Test 4: No permission → no enforcement
// =============================================================================

async function testNoPermissionNoEnforcement(): Promise<void> {
  const { ctx, events } = createScopedContext(undefined);

  await statusCommand(ctx, { bundle_id: "b-1", status: "approved" });
  await pushResultCommand(ctx, { bundle_id: "b-1", resolution_summary: "Fix", files_changed: [] });

  assert(events.length === 2, `Expected 2 events, got ${events.length}`);
  const allSuccess = events.every((e) => e.status === "success");
  assert(allSuccess, "All events should be success when no permission set");

  pass("No permission set → mutating commands allowed");
}

// =============================================================================
// Test 5: Denied event has correct CLI audit shape
// =============================================================================

async function testDeniedEventShape(): Promise<void> {
  const { ctx, events } = createScopedContext("read");

  try {
    await statusCommand(ctx, { bundle_id: "b-shape", status: "rejected" });
  } catch {
    // expected
  }

  assert(events.length === 1, `Expected 1 event, got ${events.length}`);
  const event = events[0]!;

  assert(event.status === "denied", `Status should be "denied"`);
  assert(event.error_code === "SCOPE_DENIED", `Error code should be "SCOPE_DENIED"`);
  assert(typeof event.error_message === "string" && event.error_message.length > 0, "Error message should exist");
  assert(event.action === "status", `Action should be "status"`);
  assert(event.source === "cli", `Source should be "cli"`);
  assert(event.actor_type === "agent", `Actor type should be "agent"`);
  assert(event.actor_id === "cli-scope-test", `Actor ID should match`);
  assert(event.target_entity_type === "bundle", `Target type should be "bundle"`);
  assert(event.target_entity_id === "b-shape", `Target ID should match`);
  assert(typeof event.timestamp === "string", "Timestamp should exist");
  assert(typeof event.id === "string", "ID should exist");

  pass("CLI denied event has full AgentAction shape with SCOPE_DENIED");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Token Scope Enforcement Tests (CLI) ===\n");

const tests = [
  testReadTokenAllowsReadCommands,
  testReadTokenDeniedOnMutatingCommands,
  testReadWriteTokenAllowsAll,
  testNoPermissionNoEnforcement,
  testDeniedEventShape,
];

(async () => {
  for (const test of tests) {
    try {
      await test();
    } catch (err) {
      failed++;
      console.error(`FAIL: ${test.name} — ${(err as Error).message}`);
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
})();
