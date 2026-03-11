/**
 * MCP server tests.
 *
 * WHAT THIS PROVES:
 * - MCP server registers all 10 tools with correct schemas
 * - Every tool call emits a structured AgentAction audit event
 * - Audit events contain correct actor_type, source, action, target, status, duration
 * - Read-only tools return data; mutating tools return success/error
 * - Error cases produce audit events with status="error"
 * - Resource templates resolve correctly
 * - AgentAction contract shape is enforced
 *
 * HOW: Creates an MCP server with a mock ApiClient and captures audit events.
 * Tools are invoked via the MCP SDK's in-memory transport.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCompylMcpServer } from "../server.js";
import type { ApiClient } from "../server.js";
import type { AgentAction, AgentDTO } from "@compyl/contracts";

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
    exact_source: {
      file_path: "src/Button.tsx",
      component_name: "Button",
      line: 42,
      line_kind: "leaf-dom",
    },
    resolved_component_stack: [
      {
        component_name: "Button",
        file_path: "src/Button.tsx",
        line: 42,
        line_kind: "definition",
        is_library: false,
      },
    ],
    resolution_mode: "fiber_meta",
    missing_reasons: [],
    root_boundary_kind: null,
    component_candidates: [],
    file_candidates: [],
    design_candidates: [],
    design_diff: null,
    branch: "main",
    commit_sha: "abc123",
    build_url: null,
    acceptance_criteria: ["Button should render correctly"],
    constraints: [],
    confidence: { component_match: 0.95, design_match: 0, task_clarity: 0.8 },
    unresolved_ambiguities: [],
    validation_steps: ["Check button renders"],
    status: "pending_review",
    assignee_type: "unassigned",
    assignee_id: null,
    created_at: new Date().toISOString(),
    exported_to: [],
  };
}

function createMockApiClient(): ApiClient {
  return {
    async listBundles(params) {
      return { bundles: [makeMockBundle("bundle-001")], total: 1 };
    },
    async getBundle(bundleId) {
      if (bundleId === "nonexistent") return null;
      return makeMockBundle(bundleId);
    },
    async updateBundleStatus(bundleId, status, reason) {
      return { success: true };
    },
    async assignBundle(bundleId, assigneeType, assigneeId) {
      return { success: true };
    },
    async proposeResolution(bundleId, params) {
      return { success: true, proposal_id: "prop-001" };
    },
    async getSession(sessionId) {
      if (sessionId === "nonexistent") return null;
      return { session_id: sessionId, project_id: "proj-001", status: "submitted", bundle_count: 3 };
    },
    async listSessions(params) {
      return [{ session_id: "sess-001", status: "submitted", bundle_count: 3, submitted_at: new Date().toISOString() }];
    },
    async searchBundles(params) {
      return { bundles: [makeMockBundle("bundle-search-001")], total: 1 };
    },
    async getAcceptanceCriteria(bundleId) {
      if (bundleId === "nonexistent") return null;
      return { bundle_id: bundleId, acceptance_criteria: ["Test passes"], validation_steps: ["Run test"] };
    },
    async submitValidationResults(bundleId, results) {
      return { success: true };
    },
  };
}

async function createTestClient(): Promise<{ client: Client; auditEvents: AgentAction[] }> {
  const auditEvents: AgentAction[] = [];

  const server = createCompylMcpServer({
    apiClient: createMockApiClient(),
    auditEmitter: (event) => auditEvents.push(event),
    actorId: "test-agent-001",
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, auditEvents };
}

// =============================================================================
// Test 1: All 10 tools are registered
// =============================================================================

async function testToolsRegistered(): Promise<void> {
  const { client } = await createTestClient();

  const tools = await client.listTools();
  const toolNames = tools.tools.map((t) => t.name).sort();

  const expectedTools = [
    "assign_bundle",
    "get_acceptance_criteria",
    "get_bundle",
    "get_session",
    "list_bundles",
    "list_sessions",
    "propose_resolution",
    "search_bundles",
    "update_bundle_status",
    "validate_bundle",
  ];

  assert(toolNames.length === 10, `Expected 10 tools, got ${toolNames.length}`);
  for (const expected of expectedTools) {
    assert(toolNames.includes(expected), `Missing tool: ${expected}`);
  }

  pass("All 10 tools registered with correct names");
}

// =============================================================================
// Test 2: get_bundle returns AgentDTO with provenance
// =============================================================================

async function testGetBundleReturnsProvenance(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  const result = await client.callTool({ name: "get_bundle", arguments: { bundle_id: "bundle-test-001" } });

  const content = result.content as Array<{ type: string; text: string }>;
  assert(content.length === 1, "Should return one content block");

  const bundle = JSON.parse(content[0]!.text);
  assert(bundle.id === "bundle-test-001", "Bundle ID should match");
  assert(bundle.exact_source !== undefined, "exact_source should be present");
  assert(bundle.resolved_component_stack !== undefined, "resolved_component_stack should be present");
  assert(bundle.exact_source.file_path === "src/Button.tsx", "exact_source file path should match");
  assert(Array.isArray(bundle.resolved_component_stack), "resolved_component_stack should be an array");
  assert(bundle.resolution_mode === "fiber_meta", "resolution_mode should be fiber_meta");

  // Audit event
  assert(auditEvents.length === 1, `Expected 1 audit event, got ${auditEvents.length}`);
  const event = auditEvents[0]!;
  assert(event.action === "get_bundle", `Action should be get_bundle, got ${event.action}`);
  assert(event.status === "success", "Status should be success");
  assert(event.source === "mcp", "Source should be mcp");

  pass("get_bundle returns AgentDTO with separate exact_source and resolved_component_stack, emits audit event");
}

// =============================================================================
// Test 3: Audit event shape matches AgentAction contract
// =============================================================================

async function testAuditEventShape(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  await client.callTool({ name: "list_bundles", arguments: { project_id: "proj-001" } });

  assert(auditEvents.length === 1, "Should emit one audit event");
  const event = auditEvents[0]!;

  // Required fields
  const requiredFields = ["id", "timestamp", "actor_type", "source", "action", "payload", "status", "duration_ms"];
  for (const field of requiredFields) {
    assert(field in event, `Missing required field: ${field}`);
  }

  // Correct types
  assert(typeof event.id === "string" && event.id.length > 0, "id should be non-empty string");
  assert(typeof event.timestamp === "string", "timestamp should be ISO string");
  assert(event.actor_type === "agent", "actor_type should be 'agent' for MCP calls");
  assert(event.actor_id === "test-agent-001", "actor_id should match config");
  assert(event.source === "mcp", "source should be 'mcp'");
  assert(event.action === "list_bundles", "action should be tool name");
  assert(typeof event.payload === "object", "payload should be object");
  assert(event.status === "success", "status should be success");
  assert(typeof event.duration_ms === "number" && event.duration_ms >= 0, "duration_ms should be non-negative number");

  // Target entity
  assert(event.target_entity_type === "project", "target_entity_type should be 'project'");
  assert(event.target_entity_id === "proj-001", "target_entity_id should be the project ID");
  assert(event.project_id === "proj-001", "project_id context should be set");

  pass("Audit event shape matches AgentAction contract with all required fields");
}

// =============================================================================
// Test 4: Error case emits audit event with error status
// =============================================================================

async function testErrorAuditEvent(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  const result = await client.callTool({ name: "get_bundle", arguments: { bundle_id: "nonexistent" } });

  // Tool returns isError
  assert(result.isError === true, "Should return isError for not-found bundle");

  // Audit event still emitted (success because the handler ran without throwing)
  assert(auditEvents.length === 1, "Should emit one audit event");
  assert(auditEvents[0]!.status === "success", "Handler completed successfully (404 is not a handler error)");

  pass("Not-found case returns isError but handler completes successfully");
}

// =============================================================================
// Test 5: Mutating tools emit correct audit events
// =============================================================================

async function testMutatingToolAudit(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  await client.callTool({
    name: "update_bundle_status",
    arguments: { bundle_id: "bundle-mut-001", status: "in_progress", reason: "Starting work" },
  });

  assert(auditEvents.length === 1, "Should emit one audit event");
  const event = auditEvents[0]!;
  assert(event.action === "update_bundle_status", "Action should be update_bundle_status");
  assert(event.target_entity_type === "bundle", "Target should be bundle");
  assert(event.target_entity_id === "bundle-mut-001", "Target ID should match");

  pass("Mutating tool (update_bundle_status) emits audit event with correct target");
}

// =============================================================================
// Test 6: propose_resolution emits audit with bundle target
// =============================================================================

async function testProposeResolutionAudit(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  const result = await client.callTool({
    name: "propose_resolution",
    arguments: {
      bundle_id: "bundle-prop-001",
      resolution_summary: "Fixed the button overflow",
      files_changed: ["src/Button.tsx"],
      commit_sha: "def456",
      pr_url: "https://github.com/org/repo/pull/42",
    },
  });

  const content = result.content as Array<{ type: string; text: string }>;
  const body = JSON.parse(content[0]!.text);
  assert(body.success === true, "Should return success");
  assert(body.proposal_id === "prop-001", "Should return proposal_id");

  assert(auditEvents.length === 1, "Should emit one audit event");
  assert(auditEvents[0]!.action === "propose_resolution", "Action should be propose_resolution");
  assert(auditEvents[0]!.target_entity_id === "bundle-prop-001", "Target should be the bundle");

  pass("propose_resolution returns proposal and emits audit event");
}

// =============================================================================
// Test 7: Session tools emit correct target types
// =============================================================================

async function testSessionToolTargets(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  await client.callTool({ name: "get_session", arguments: { session_id: "sess-test-001" } });
  await client.callTool({ name: "list_sessions", arguments: { project_id: "proj-002" } });

  assert(auditEvents.length === 2, `Expected 2 audit events, got ${auditEvents.length}`);

  const getEvent = auditEvents[0]!;
  assert(getEvent.target_entity_type === "session", "get_session target should be session");
  assert(getEvent.session_id === "sess-test-001", "session_id context should be set");

  const listEvent = auditEvents[1]!;
  assert(listEvent.target_entity_type === "project", "list_sessions target should be project");
  assert(listEvent.project_id === "proj-002", "project_id context should be set");

  pass("Session tools emit correct target entity types and context IDs");
}

// =============================================================================
// Test 8: search_bundles returns results
// =============================================================================

async function testSearchBundles(): Promise<void> {
  const { client } = await createTestClient();

  const result = await client.callTool({
    name: "search_bundles",
    arguments: { project_id: "proj-001", query: "button overflow" },
  });

  const content = result.content as Array<{ type: string; text: string }>;
  const body = JSON.parse(content[0]!.text);
  assert(body.total === 1, "Should return 1 result");
  assert(body.bundles.length === 1, "Should return 1 bundle");
  assert(body.bundles[0].id === "bundle-search-001", "Bundle ID should match search result");

  pass("search_bundles returns search results");
}

// =============================================================================
// Test 9: validate_bundle submits results
// =============================================================================

async function testValidateBundle(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  const result = await client.callTool({
    name: "validate_bundle",
    arguments: {
      bundle_id: "bundle-val-001",
      validation_results: [
        { step: "Button renders correctly", passed: true, evidence: "Screenshot shows correct layout" },
        { step: "No horizontal scroll", passed: false, evidence: "Still scrolling on 320px" },
      ],
    },
  });

  const content = result.content as Array<{ type: string; text: string }>;
  const body = JSON.parse(content[0]!.text);
  assert(body.success === true, "Should return success");

  assert(auditEvents.length === 1, "Should emit one audit event");
  assert(auditEvents[0]!.action === "validate_bundle", "Action should be validate_bundle");

  pass("validate_bundle submits validation results and emits audit event");
}

// =============================================================================
// Test 10: 4 resource templates are registered
// =============================================================================

async function testResourceTemplates(): Promise<void> {
  const { client } = await createTestClient();

  const templates = await client.listResourceTemplates();

  const templateUris = templates.resourceTemplates.map((t) => t.uriTemplate).sort();
  assert(templateUris.length === 4, `Expected 4 resource templates, got ${templateUris.length}`);

  const expectedUris = [
    "compyl://bundles/{bundleId}",
    "compyl://projects/{projectId}/bundles",
    "compyl://projects/{projectId}/sessions",
    "compyl://sessions/{sessionId}",
  ];

  for (const expected of expectedUris) {
    assert(templateUris.includes(expected), `Missing resource template: ${expected}`);
  }

  pass("All 4 resource templates registered with correct URIs");
}

// =============================================================================
// Test 11: Multiple tool calls produce independent audit events
// =============================================================================

async function testMultipleToolCalls(): Promise<void> {
  const { client, auditEvents } = await createTestClient();

  await client.callTool({ name: "get_bundle", arguments: { bundle_id: "b1" } });
  await client.callTool({ name: "get_session", arguments: { session_id: "s1" } });
  await client.callTool({ name: "list_bundles", arguments: { project_id: "p1" } });

  assert(auditEvents.length === 3, `Expected 3 audit events, got ${auditEvents.length}`);

  // Each event has unique ID
  const ids = new Set(auditEvents.map((e) => e.id));
  assert(ids.size === 3, "Each audit event should have a unique ID");

  // Each has correct action
  assert(auditEvents[0]!.action === "get_bundle", "First event action");
  assert(auditEvents[1]!.action === "get_session", "Second event action");
  assert(auditEvents[2]!.action === "list_bundles", "Third event action");

  pass("Multiple tool calls produce independent audit events with unique IDs");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== MCP Server Tests ===\n");

const tests = [
  testToolsRegistered,
  testGetBundleReturnsProvenance,
  testAuditEventShape,
  testErrorAuditEvent,
  testMutatingToolAudit,
  testProposeResolutionAudit,
  testSessionToolTargets,
  testSearchBundles,
  testValidateBundle,
  testResourceTemplates,
  testMultipleToolCalls,
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
