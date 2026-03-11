/**
 * Token scope enforcement tests.
 *
 * WHAT THIS PROVES:
 * - Read-only tokens can call all read tools (list_bundles, get_bundle, etc.)
 * - Read-only tokens are DENIED on mutating tools (update_bundle_status, assign_bundle, etc.)
 * - Denied actions produce audit events with status="denied" and error_code="SCOPE_DENIED"
 * - ReadWrite tokens can call both read and mutating tools
 * - No permission set → no enforcement (embedded mode)
 *
 * HOW: Creates MCP servers with different permission levels and verifies tool access.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCompylMcpServer } from "../server.js";
import type { ApiClient } from "../server.js";
import type { AgentAction, AgentDTO, AgentTokenPermission } from "@compyl/contracts";

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
    summary: "Test summary",
    normalized_task: "Fix test",
    category: "visual_bug",
    severity: "major",
    page_url: "https://example.com",
    viewport: { width: 1920, height: 1080, scroll_x: 0, scroll_y: 0 },
    screenshot_url: "",
    annotation_coordinates: {},
    dom_selector: "#test",
    computed_styles: {},
    client_raw_text: "Something looks wrong",
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
    commit_sha: "abc123",
    build_url: null,
    acceptance_criteria: ["Test passes"],
    constraints: [],
    confidence: { component_match: 0.5, design_match: 0, task_clarity: 0.5 },
    unresolved_ambiguities: [],
    validation_steps: ["Run test"],
    status: "pending_review",
    assignee_type: "unassigned",
    assignee_id: null,
    created_at: new Date().toISOString(),
    exported_to: [],
  };
}

function createMockApiClient(): ApiClient {
  return {
    async listBundles() { return { bundles: [makeMockBundle("b-001")], total: 1 }; },
    async getBundle(id) { return makeMockBundle(id); },
    async updateBundleStatus() { return { success: true }; },
    async assignBundle() { return { success: true }; },
    async proposeResolution() { return { success: true, proposal_id: "p-1" }; },
    async getSession(id) { return { session_id: id, project_id: "p-1", status: "submitted", bundle_count: 1 }; },
    async listSessions() { return [{ session_id: "s-1", status: "submitted", bundle_count: 1, submitted_at: new Date().toISOString() }]; },
    async searchBundles() { return { bundles: [makeMockBundle("b-search")], total: 1 }; },
    async getAcceptanceCriteria(id) { return { bundle_id: id, acceptance_criteria: ["Test"], validation_steps: ["Step"] }; },
    async submitValidationResults() { return { success: true }; },
  };
}

async function createScopedClient(permission?: AgentTokenPermission): Promise<{
  client: Client;
  auditEvents: AgentAction[];
}> {
  const auditEvents: AgentAction[] = [];

  const server = createCompylMcpServer({
    apiClient: createMockApiClient(),
    auditEmitter: (event) => auditEvents.push(event),
    actorId: "test-agent-scope",
    permission,
  });

  const client = new Client({ name: "scope-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, auditEvents };
}

// Read-only tools
const READ_TOOLS = [
  { name: "list_bundles", args: { project_id: "proj-1" } },
  { name: "get_bundle", args: { bundle_id: "b-1" } },
  { name: "get_session", args: { session_id: "s-1" } },
  { name: "list_sessions", args: { project_id: "proj-1" } },
  { name: "search_bundles", args: { project_id: "proj-1", query: "test" } },
  { name: "get_acceptance_criteria", args: { bundle_id: "b-1" } },
];

// Mutating tools
const MUTATING_TOOLS = [
  { name: "update_bundle_status", args: { bundle_id: "b-1", status: "in_progress" } },
  { name: "assign_bundle", args: { bundle_id: "b-1", assignee_type: "agent", assignee_id: "agent-1" } },
  { name: "propose_resolution", args: { bundle_id: "b-1", resolution_summary: "Fixed", files_changed: ["a.ts"] } },
  { name: "validate_bundle", args: { bundle_id: "b-1", validation_results: [{ step: "Test", passed: true }] } },
];

// =============================================================================
// Test 1: Read-only token can call all read tools
// =============================================================================

async function testReadTokenAllowsReadTools(): Promise<void> {
  const { client, auditEvents } = await createScopedClient("read");

  for (const tool of READ_TOOLS) {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    const content = result.content as Array<{ type: string; text: string }>;
    assert(content.length > 0, `${tool.name} should return content`);
    assert(!result.isError, `${tool.name} should succeed with read token`);
  }

  // All audit events should be "success"
  for (const event of auditEvents) {
    assert(event.status === "success", `Read tool "${event.action}" audit should be success, got "${event.status}"`);
  }

  pass(`Read-only token allowed all ${READ_TOOLS.length} read tools`);
}

// =============================================================================
// Test 2: Read-only token is DENIED on all mutating tools
// =============================================================================

async function testReadTokenDeniedOnMutatingTools(): Promise<void> {
  const { client, auditEvents } = await createScopedClient("read");

  for (const tool of MUTATING_TOOLS) {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    // MCP SDK wraps errors — check isError flag
    assert(result.isError === true, `${tool.name} should be denied with read token`);
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]?.text ?? "";
    assert(text.includes("write permission") || text.includes("SCOPE_DENIED") || text.includes("requires write"),
      `${tool.name} error message should mention scope denial, got: ${text}`);
  }

  // Verify audit events have status="denied"
  const deniedEvents = auditEvents.filter((e) => e.status === "denied");
  assert(deniedEvents.length === MUTATING_TOOLS.length,
    `Expected ${MUTATING_TOOLS.length} denied audit events, got ${deniedEvents.length}`);

  for (const event of deniedEvents) {
    assert(event.error_code === "SCOPE_DENIED", `Denied event error_code should be "SCOPE_DENIED", got "${event.error_code}"`);
    assert(event.source === "mcp", `Denied event source should be "mcp", got "${event.source}"`);
  }

  pass(`Read-only token denied all ${MUTATING_TOOLS.length} mutating tools with audited "denied" status`);
}

// =============================================================================
// Test 3: ReadWrite token allows all tools
// =============================================================================

async function testReadWriteTokenAllowsAll(): Promise<void> {
  const { client, auditEvents } = await createScopedClient("readwrite");

  // Read tools
  for (const tool of READ_TOOLS) {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    assert(!result.isError, `${tool.name} should succeed with readwrite token`);
  }

  // Mutating tools
  for (const tool of MUTATING_TOOLS) {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    assert(!result.isError, `${tool.name} should succeed with readwrite token`);
  }

  const allSuccess = auditEvents.every((e) => e.status === "success");
  assert(allSuccess, "All audit events should be success for readwrite token");

  pass(`ReadWrite token allowed all ${READ_TOOLS.length + MUTATING_TOOLS.length} tools`);
}

// =============================================================================
// Test 4: Full permission allows all tools
// =============================================================================

async function testFullTokenAllowsAll(): Promise<void> {
  const { client, auditEvents } = await createScopedClient("full");

  for (const tool of [...READ_TOOLS, ...MUTATING_TOOLS]) {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    assert(!result.isError, `${tool.name} should succeed with full token`);
  }

  const allSuccess = auditEvents.every((e) => e.status === "success");
  assert(allSuccess, "All audit events should be success for full token");

  pass("Full token allowed all tools");
}

// =============================================================================
// Test 5: No permission set → no enforcement
// =============================================================================

async function testNoPermissionNoEnforcement(): Promise<void> {
  const { client, auditEvents } = await createScopedClient(undefined);

  for (const tool of MUTATING_TOOLS) {
    const result = await client.callTool({ name: tool.name, arguments: tool.args });
    assert(!result.isError, `${tool.name} should succeed without permission set`);
  }

  const allSuccess = auditEvents.every((e) => e.status === "success");
  assert(allSuccess, "All audit events should be success when no permission is set");

  pass("No permission set → mutating tools allowed (embedded mode)");
}

// =============================================================================
// Test 6: Denied audit event has correct shape
// =============================================================================

async function testDeniedAuditEventShape(): Promise<void> {
  const { client, auditEvents } = await createScopedClient("read");

  await client.callTool({ name: "update_bundle_status", arguments: { bundle_id: "b-shape", status: "approved" } });

  assert(auditEvents.length === 1, `Expected 1 audit event, got ${auditEvents.length}`);

  const event = auditEvents[0]!;
  assert(event.status === "denied", `Status should be "denied", got "${event.status}"`);
  assert(event.error_code === "SCOPE_DENIED", `Error code should be "SCOPE_DENIED"`);
  assert(typeof event.error_message === "string" && event.error_message.length > 0, "Error message should be non-empty");
  assert(event.action === "update_bundle_status", `Action should be "update_bundle_status"`);
  assert(event.actor_type === "agent", `Actor type should be "agent"`);
  assert(event.actor_id === "test-agent-scope", `Actor ID should match`);
  assert(event.source === "mcp", `Source should be "mcp"`);
  assert(event.target_entity_type === "bundle", `Target entity type should be "bundle"`);
  assert(event.target_entity_id === "b-shape", `Target entity ID should match`);
  assert(typeof event.timestamp === "string", "Timestamp should be string");
  assert(typeof event.id === "string" && event.id.length > 0, "ID should be UUID string");
  assert(event.duration_ms >= 0, "Duration should be >= 0");

  pass("Denied audit event has full AgentAction shape with SCOPE_DENIED error");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Token Scope Enforcement Tests (MCP) ===\n");

const tests = [
  testReadTokenAllowsReadTools,
  testReadTokenDeniedOnMutatingTools,
  testReadWriteTokenAllowsAll,
  testFullTokenAllowsAll,
  testNoPermissionNoEnforcement,
  testDeniedAuditEventShape,
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
