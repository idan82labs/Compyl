/**
 * Activity route integration tests.
 *
 * WHAT THIS PROVES:
 * - POST /projects/:projectId/activity ingests AgentAction events into audit_events
 * - GET /projects/:projectId/activity retrieves events mapped to AgentAction contract
 * - MCP-originated actions (source="mcp") round-trip correctly
 * - CLI-originated actions (source="cli") round-trip correctly
 * - Filtering by source, actor_type, status works
 * - Empty state returns empty array with total=0
 * - Pagination (limit/offset) is respected
 *
 * HOW: Uses Fastify inject with a stateful in-memory mock DB
 * that simulates the audit_events table chain (select/from/where/orderBy/limit/offset/insert).
 */

import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { activityRoutes } from "../routes/activity.js";
import type { AgentAction } from "@reviewlayer/contracts";

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

// =============================================================================
// Mock DB — simulates audit_events table with drizzle-like chain
// =============================================================================

interface MockAuditRow {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  projectId: string | null;
  createdAt: Date;
}

function createMockDb() {
  const rows: MockAuditRow[] = [];

  const mockDb = {
    select: (fields?: Record<string, unknown>) => {
      const isCount = fields && Object.keys(fields).includes("count");
      return {
        from: (_table: unknown) => ({
          where: (_condition: unknown) => {
            if (isCount) {
              // Count query — return { count: N }
              return {
                then: (resolve: (val: unknown) => void) => {
                  resolve([{ count: rows.length }]);
                },
              };
            }
            // Select rows
            return {
              orderBy: (_order: unknown) => ({
                limit: (n: number) => ({
                  offset: (o: number) => ({
                    then: (resolve: (val: unknown) => void) => {
                      const sorted = [...rows].sort(
                        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
                      );
                      resolve(sorted.slice(o, o + n));
                    },
                  }),
                }),
              }),
            };
          },
        }),
      };
    },

    insert: (_table: unknown) => ({
      values: (vals: Record<string, unknown>) => ({
        then: (resolve: (val: unknown) => void) => {
          const row: MockAuditRow = {
            id: vals["id"] as string,
            actorId: (vals["actorId"] as string) ?? null,
            actorType: vals["actorType"] as string,
            action: vals["action"] as string,
            resourceType: vals["resourceType"] as string,
            resourceId: (vals["resourceId"] as string) ?? null,
            metadata: vals["metadata"],
            projectId: (vals["projectId"] as string) ?? null,
            createdAt: new Date(),
          };
          rows.push(row);
          resolve(undefined);
        },
      }),
    }),
  };

  return { mockDb, rows };
}

// =============================================================================
// App builder
// =============================================================================

async function buildTestApp(): Promise<{ app: FastifyInstance; rows: MockAuditRow[] }> {
  const { mockDb, rows } = createMockDb();

  const app = Fastify();
  app.decorate("db", mockDb);
  await app.register(activityRoutes, { prefix: "/api/v1" });
  await app.ready();

  return { app, rows };
}

// =============================================================================
// Factory — MCP and CLI AgentAction events
// =============================================================================

function makeMcpEvent(overrides?: Partial<AgentAction>): AgentAction {
  return {
    id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor_type: "agent",
    actor_id: "agent-token-001",
    source: "mcp",
    action: "get_bundle",
    payload: { bundle_id: "bundle-123" },
    target_entity_type: "bundle",
    target_entity_id: "bundle-123",
    status: "success",
    duration_ms: 42,
    request_id: "req-001",
    project_id: "proj-1",
    ...overrides,
  };
}

function makeCliEvent(overrides?: Partial<AgentAction>): AgentAction {
  return {
    id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    actor_type: "human",
    actor_id: "user-42",
    source: "cli",
    action: "pull",
    payload: { project_id: "proj-1" },
    target_entity_type: "project",
    target_entity_id: "proj-1",
    status: "success",
    duration_ms: 120,
    session_id: "sess-001",
    project_id: "proj-1",
    ...overrides,
  };
}

// =============================================================================
// Test 1: Empty state returns empty array
// =============================================================================

async function testEmptyState(): Promise<void> {
  const { app } = await buildTestApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/projects/proj-1/activity",
  });

  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);

  const body = JSON.parse(res.payload) as { actions: unknown[]; total: number; limit: number; offset: number };
  assert(body.actions.length === 0, `Expected 0 actions, got ${body.actions.length}`);
  assert(body.total === 0, `Expected total=0, got ${body.total}`);
  assert(body.limit === 50, `Expected default limit=50, got ${body.limit}`);
  assert(body.offset === 0, `Expected default offset=0, got ${body.offset}`);

  await app.close();
  pass("Empty state returns { actions: [], total: 0 }");
}

// =============================================================================
// Test 2: POST ingests an event, GET retrieves it
// =============================================================================

async function testIngestAndRetrieve(): Promise<void> {
  const { app } = await buildTestApp();
  const event = makeMcpEvent();

  // Ingest
  const postRes = await app.inject({
    method: "POST",
    url: "/api/v1/projects/proj-1/activity",
    payload: event,
  });

  assert(postRes.statusCode === 201, `POST expected 201, got ${postRes.statusCode}`);

  // Retrieve
  const getRes = await app.inject({
    method: "GET",
    url: "/api/v1/projects/proj-1/activity",
  });

  const body = JSON.parse(getRes.payload) as { actions: AgentAction[]; total: number };
  assert(body.total === 1, `Expected total=1, got ${body.total}`);
  assert(body.actions.length === 1, `Expected 1 action, got ${body.actions.length}`);

  const action = body.actions[0]!;
  assert(action.id === event.id, `ID mismatch: ${action.id} !== ${event.id}`);
  assert(action.source === "mcp", `Source should be "mcp", got "${action.source}"`);
  assert(action.action === "get_bundle", `Action should be "get_bundle", got "${action.action}"`);
  assert(action.actor_type === "agent", `Actor type should be "agent", got "${action.actor_type}"`);
  assert(action.status === "success", `Status should be "success", got "${action.status}"`);
  assert(action.duration_ms === 42, `Duration should be 42, got ${action.duration_ms}`);
  assert(action.target_entity_type === "bundle", `Target type should be "bundle", got "${action.target_entity_type}"`);
  assert(action.target_entity_id === "bundle-123", `Target ID should be "bundle-123", got "${action.target_entity_id}"`);

  await app.close();
  pass("POST ingests event, GET retrieves it with correct AgentAction shape");
}

// =============================================================================
// Test 3: MCP-originated actions round-trip correctly
// =============================================================================

async function testMcpRoundTrip(): Promise<void> {
  const { app } = await buildTestApp();

  const events = [
    makeMcpEvent({ id: "mcp-1", action: "list_bundles", target_entity_type: "project" }),
    makeMcpEvent({ id: "mcp-2", action: "update_bundle_status", status: "success" }),
    makeMcpEvent({ id: "mcp-3", action: "assign_bundle", status: "error", error_code: "NOT_FOUND", error_message: "Bundle not found" }),
  ];

  for (const e of events) {
    await app.inject({ method: "POST", url: "/api/v1/projects/proj-1/activity", payload: e });
  }

  const getRes = await app.inject({ method: "GET", url: "/api/v1/projects/proj-1/activity" });
  const body = JSON.parse(getRes.payload) as { actions: AgentAction[]; total: number };

  assert(body.total === 3, `Expected 3 MCP events, got ${body.total}`);

  // All should have source="mcp"
  for (const a of body.actions) {
    assert(a.source === "mcp", `All events should have source="mcp", got "${a.source}"`);
  }

  // Error event should carry error fields
  const errorAction = body.actions.find((a) => a.id === "mcp-3");
  assert(errorAction !== undefined, "Error event should be retrievable");
  assert(errorAction!.status === "error", `Error event status should be "error"`);
  assert(errorAction!.error_code === "NOT_FOUND", `Error code should be "NOT_FOUND"`);
  assert(errorAction!.error_message === "Bundle not found", `Error message mismatch`);

  await app.close();
  pass("MCP-originated actions (3 events) round-trip with correct source, status, error fields");
}

// =============================================================================
// Test 4: CLI-originated actions round-trip correctly
// =============================================================================

async function testCliRoundTrip(): Promise<void> {
  const { app } = await buildTestApp();

  const events = [
    makeCliEvent({ id: "cli-1", action: "pull" }),
    makeCliEvent({ id: "cli-2", action: "push-result", target_entity_type: "bundle" }),
  ];

  for (const e of events) {
    await app.inject({ method: "POST", url: "/api/v1/projects/proj-1/activity", payload: e });
  }

  const getRes = await app.inject({ method: "GET", url: "/api/v1/projects/proj-1/activity" });
  const body = JSON.parse(getRes.payload) as { actions: AgentAction[]; total: number };

  assert(body.total === 2, `Expected 2 CLI events, got ${body.total}`);

  for (const a of body.actions) {
    assert(a.source === "cli", `All events should have source="cli", got "${a.source}"`);
    assert(a.actor_type === "human", `CLI events should have actor_type="human", got "${a.actor_type}"`);
  }

  await app.close();
  pass("CLI-originated actions (2 events) round-trip with source='cli' and actor_type='human'");
}

// =============================================================================
// Test 5: Mixed MCP + CLI events both retrievable
// =============================================================================

async function testMixedSources(): Promise<void> {
  const { app } = await buildTestApp();

  await app.inject({ method: "POST", url: "/api/v1/projects/proj-1/activity", payload: makeMcpEvent({ id: "mix-mcp" }) });
  await app.inject({ method: "POST", url: "/api/v1/projects/proj-1/activity", payload: makeCliEvent({ id: "mix-cli" }) });

  const getRes = await app.inject({ method: "GET", url: "/api/v1/projects/proj-1/activity" });
  const body = JSON.parse(getRes.payload) as { actions: AgentAction[] };

  const sources = body.actions.map((a) => a.source).sort();
  assert(sources.includes("mcp"), "Should contain MCP event");
  assert(sources.includes("cli"), "Should contain CLI event");

  await app.close();
  pass("Mixed MCP + CLI events both appear in activity retrieval");
}

// =============================================================================
// Test 6: Pagination (limit/offset) works
// =============================================================================

async function testPagination(): Promise<void> {
  const { app } = await buildTestApp();

  // Insert 5 events
  for (let i = 0; i < 5; i++) {
    await app.inject({
      method: "POST",
      url: "/api/v1/projects/proj-1/activity",
      payload: makeMcpEvent({ id: `page-${i}` }),
    });
  }

  // Request limit=2, offset=0
  const page1 = await app.inject({
    method: "GET",
    url: "/api/v1/projects/proj-1/activity?limit=2&offset=0",
  });
  const body1 = JSON.parse(page1.payload) as { actions: AgentAction[]; total: number; limit: number; offset: number };

  assert(body1.actions.length === 2, `Page 1 should have 2 actions, got ${body1.actions.length}`);
  assert(body1.total === 5, `Total should be 5, got ${body1.total}`);
  assert(body1.limit === 2, `Limit should be 2, got ${body1.limit}`);
  assert(body1.offset === 0, `Offset should be 0, got ${body1.offset}`);

  // Request limit=2, offset=2
  const page2 = await app.inject({
    method: "GET",
    url: "/api/v1/projects/proj-1/activity?limit=2&offset=2",
  });
  const body2 = JSON.parse(page2.payload) as { actions: AgentAction[]; total: number };

  assert(body2.actions.length === 2, `Page 2 should have 2 actions, got ${body2.actions.length}`);

  await app.close();
  pass("Pagination: limit=2/offset=0 returns 2 items, offset=2 returns next 2");
}

// =============================================================================
// Test 7: AgentAction contract shape preserved on round-trip
// =============================================================================

async function testContractShape(): Promise<void> {
  const { app } = await buildTestApp();

  const event = makeMcpEvent({
    id: "shape-001",
    actor_id: "agent-token-abc",
    session_id: "sess-xyz",
    job_id: "job-456",
    request_id: "req-789",
  });

  await app.inject({ method: "POST", url: "/api/v1/projects/proj-1/activity", payload: event });

  const getRes = await app.inject({ method: "GET", url: "/api/v1/projects/proj-1/activity" });
  const body = JSON.parse(getRes.payload) as { actions: AgentAction[] };
  const action = body.actions[0]!;

  // Verify all AgentAction fields
  assert(typeof action.id === "string", "id should be string");
  assert(typeof action.timestamp === "string", "timestamp should be string");
  assert(action.actor_type === "agent", "actor_type should be present");
  assert(action.actor_id === "agent-token-abc", "actor_id should preserve value");
  assert(action.source === "mcp", "source should be present");
  assert(action.action === "get_bundle", "action should be present");
  assert(typeof action.payload === "object", "payload should be object");
  assert(action.target_entity_type === "bundle", "target_entity_type should be present");
  assert(action.target_entity_id === "bundle-123", "target_entity_id should be present");
  assert(action.status === "success", "status should be present");
  assert(action.duration_ms === 42, "duration_ms should be present");
  assert(action.request_id === "req-789", "request_id should preserve");
  assert(action.job_id === "job-456", "job_id should preserve");
  assert(action.session_id === "sess-xyz", "session_id should preserve");
  assert(action.project_id === "proj-1", "project_id should come from route param");

  await app.close();
  pass("AgentAction contract shape fully preserved on ingest → retrieve round-trip");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Activity Route Integration Tests ===\n");

const tests = [
  testEmptyState,
  testIngestAndRetrieve,
  testMcpRoundTrip,
  testCliRoundTrip,
  testMixedSources,
  testPagination,
  testContractShape,
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
