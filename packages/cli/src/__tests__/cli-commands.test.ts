/**
 * CLI command tests.
 *
 * WHAT THIS PROVES:
 * - CLI commands use the same ApiClient interface as MCP server
 * - Every CLI command emits a structured AgentAction audit event with source="cli"
 * - Audit events contain correct actor_type, action, target, timing
 * - CLI commands map to the same underlying contracts as MCP tools
 * - Error cases produce audit events with error status
 *
 * HOW: Creates commands with a mock ApiClient and captures audit events.
 */

import type { ApiClient } from "@reviewlayer/mcp-server";
import type { AgentAction, AgentDTO } from "@reviewlayer/contracts";
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
    title: "Test bundle",
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

function createMockContext(): { ctx: CommandContext; events: AgentAction[] } {
  const events: AgentAction[] = [];

  const api: ApiClient = {
    async listBundles() { return { bundles: [makeMockBundle("b1")], total: 1 }; },
    async getBundle(id) { return id === "missing" ? null : makeMockBundle(id); },
    async updateBundleStatus() { return { success: true }; },
    async assignBundle() { return { success: true }; },
    async proposeResolution() { return { success: true, proposal_id: "p1" }; },
    async getSession(id) { return { session_id: id, project_id: "proj", status: "submitted", bundle_count: 1 }; },
    async listSessions() { return []; },
    async searchBundles() { return { bundles: [makeMockBundle("s1")], total: 1 }; },
    async getAcceptanceCriteria(id) { return { bundle_id: id, acceptance_criteria: ["Test"], validation_steps: ["Run"] }; },
    async submitValidationResults() { return { success: true }; },
  };

  const ctx: CommandContext = {
    api,
    audit: (event) => events.push(event),
    actorId: "cli-test",
    projectId: "proj-default",
  };

  return { ctx, events };
}

// =============================================================================
// Test 1: pull command emits audit event with source="cli"
// =============================================================================

async function testPullAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  const result = await pullCommand(ctx, { project_id: "proj-001" });

  assert(result.total === 1, "Should return results");
  assert(events.length === 1, `Expected 1 event, got ${events.length}`);

  const e = events[0]!;
  assert(e.source === "cli", `Source should be cli, got ${e.source}`);
  assert(e.action === "pull", `Action should be pull, got ${e.action}`);
  assert(e.actor_type === "agent", "Actor type should be agent");
  assert(e.target_entity_type === "project", "Target should be project");
  assert(e.target_entity_id === "proj-001", "Target ID should match");
  assert(e.status === "success", "Status should be success");
  assert(typeof e.duration_ms === "number", "duration_ms should be number");

  pass("pull command emits audit event with source='cli' and correct target");
}

// =============================================================================
// Test 2: bundle command emits audit with bundle target
// =============================================================================

async function testBundleAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  const result = await bundleCommand(ctx, { bundle_id: "b-test" });

  assert(result !== null, "Should return bundle");
  assert(events.length === 1, "Should emit one event");
  assert(events[0]!.action === "bundle", "Action should be 'bundle'");
  assert(events[0]!.target_entity_type === "bundle", "Target should be bundle");
  assert(events[0]!.target_entity_id === "b-test", "Target ID should match");

  pass("bundle command emits audit event with bundle target");
}

// =============================================================================
// Test 3: status command (mutating) emits audit
// =============================================================================

async function testStatusAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  const result = await statusCommand(ctx, { bundle_id: "b-status", status: "in_progress", reason: "Starting" });

  assert(result.success === true, "Should succeed");
  assert(events.length === 1, "Should emit one event");
  assert(events[0]!.action === "status", "Action should be 'status'");
  assert(events[0]!.source === "cli", "Source should be cli");

  pass("status command (mutating) emits audit event");
}

// =============================================================================
// Test 4: push-result maps to propose_resolution
// =============================================================================

async function testPushResultAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  const result = await pushResultCommand(ctx, {
    bundle_id: "b-pr",
    resolution_summary: "Fixed overflow",
    files_changed: ["src/Button.tsx"],
    commit_sha: "abc123",
    pr_url: "https://github.com/org/repo/pull/1",
  });

  assert(result.success === true, "Should succeed");
  assert(result.proposal_id === "p1", "Should return proposal_id");
  assert(events.length === 1, "Should emit one event");
  assert(events[0]!.action === "push-result", "Action should be 'push-result'");

  pass("push-result command maps to proposeResolution and emits audit");
}

// =============================================================================
// Test 5: plan command returns acceptance criteria
// =============================================================================

async function testPlanAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  const result = await planCommand(ctx, { bundle_id: "b-plan" }) as { acceptance_criteria: string[] };

  assert(result.acceptance_criteria.length === 1, "Should return acceptance criteria");
  assert(events.length === 1, "Should emit one event");
  assert(events[0]!.action === "plan", "Action should be 'plan'");

  pass("plan command returns acceptance criteria and emits audit");
}

// =============================================================================
// Test 6: validate command submits results
// =============================================================================

async function testValidateAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  const result = await validateCommand(ctx, {
    bundle_id: "b-val",
    validation_results: [{ step: "Check render", passed: true }],
  });

  assert(result.success === true, "Should succeed");
  assert(events.length === 1, "Should emit one event");
  assert(events[0]!.action === "validate", "Action should be 'validate'");

  pass("validate command submits results and emits audit");
}

// =============================================================================
// Test 7: diff command maps to searchBundles
// =============================================================================

async function testDiffAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  const result = await diffCommand(ctx, { project_id: "proj-diff", query: "button" });

  assert(result.total === 1, "Should return search results");
  assert(events.length === 1, "Should emit one event");
  assert(events[0]!.action === "diff", "Action should be 'diff'");
  assert(events[0]!.project_id === "proj-diff", "Project ID should match");

  pass("diff command maps to searchBundles and emits audit with project context");
}

// =============================================================================
// Test 8: All CLI commands use source="cli" (not "mcp")
// =============================================================================

async function testAllSourcesCli(): Promise<void> {
  const { ctx, events } = createMockContext();

  await pullCommand(ctx, { project_id: "p" });
  await bundleCommand(ctx, { bundle_id: "b" });
  await statusCommand(ctx, { bundle_id: "b", status: "approved" });
  await planCommand(ctx, { bundle_id: "b" });
  await pushResultCommand(ctx, { bundle_id: "b", resolution_summary: "fix", files_changed: [] });
  await validateCommand(ctx, { bundle_id: "b", validation_results: [] });
  await diffCommand(ctx, { project_id: "p", query: "q" });

  assert(events.length === 7, `Expected 7 events, got ${events.length}`);
  for (const event of events) {
    assert(event.source === "cli", `Event ${event.action} should have source='cli', got ${event.source}`);
  }

  pass("All 7 CLI commands emit source='cli' in audit events");
}

// =============================================================================
// Test 9: Error case produces audit event with error status
// =============================================================================

async function testErrorAudit(): Promise<void> {
  const { ctx, events } = createMockContext();

  // Override api to throw
  const failingCtx: CommandContext = {
    ...ctx,
    api: {
      ...ctx.api,
      async getBundle() { throw new Error("Connection refused"); },
    },
  };

  let threw = false;
  try {
    await bundleCommand(failingCtx, { bundle_id: "b-err" });
  } catch {
    threw = true;
  }

  assert(threw, "Should throw on API error");
  assert(events.length === 1, "Should still emit audit event on error");
  assert(events[0]!.status === "error", "Status should be error");
  assert(events[0]!.error_code === "CLI_ERROR", "Error code should be CLI_ERROR");
  assert(events[0]!.error_message === "Connection refused", "Error message should match");

  pass("Error case produces audit event with error status and message");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== CLI Command Tests ===\n");

const tests = [
  testPullAudit,
  testBundleAudit,
  testStatusAudit,
  testPushResultAudit,
  testPlanAudit,
  testValidateAudit,
  testDiffAudit,
  testAllSourcesCli,
  testErrorAudit,
];

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
