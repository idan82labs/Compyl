/**
 * Worker client diagnostic event tests.
 *
 * WHAT THIS PROVES:
 * - Every worker job emits a diagnostic event (success or failure)
 * - Diagnostic events match the ApiJobDiagnosticEvent contract
 * - Retry count is tracked accurately
 * - Timeout errors produce "timeout" status
 * - Network errors produce "network_error" status
 * - Worker-reported duration_ms is captured as worker_duration_ms
 * - Session/annotation context is extracted from payload
 *
 * HOW: Intercepts global fetch to simulate worker responses,
 * uses the diagnostic callback on WorkerClient.
 */

import { WorkerClient } from "../worker-client.js";
import type { ApiJobDiagnosticEvent, WorkerJobRequest } from "@reviewlayer/contracts";

// =============================================================================
// Test infrastructure
// =============================================================================

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init);
  }) as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

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

function makeRequest(overrides?: Partial<WorkerJobRequest<unknown>>): WorkerJobRequest<{ annotation_id: string; session_id: string }> {
  return {
    job_id: "job-diag-001",
    job_type: "summarize_annotation",
    payload: { annotation_id: "ann-001", session_id: "session-001" },
    idempotency_key: "summarize:ann-001",
    created_at: new Date().toISOString(),
    ...overrides,
  } as WorkerJobRequest<{ annotation_id: string; session_id: string }>;
}

// =============================================================================
// Test 1: Successful job emits diagnostic with correct fields
// =============================================================================

async function testSuccessfulJobDiagnostic(): Promise<void> {
  const events: ApiJobDiagnosticEvent[] = [];

  mockFetch(() => new Response(JSON.stringify({
    job_id: "job-diag-001",
    status: "completed",
    result: { title: "Test" },
    duration_ms: 42,
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const client = new WorkerClient({
    baseUrl: "http://localhost:8001",
    onDiagnostic: (e) => events.push(e),
  });

  await client.submitJob(makeRequest());

  assert(events.length === 1, `Expected 1 diagnostic event, got ${events.length}`);

  const e = events[0]!;
  assert(e.job_id === "job-diag-001", `job_id should be job-diag-001, got ${e.job_id}`);
  assert(e.job_type === "summarize_annotation", `job_type should be summarize_annotation, got ${e.job_type}`);
  assert(e.status === "completed", `status should be completed, got ${e.status}`);
  assert(e.duration_ms >= 0, `duration_ms should be >= 0, got ${e.duration_ms}`);
  assert(e.retries === 0, `retries should be 0, got ${e.retries}`);
  assert(e.idempotency_key === "summarize:ann-001", `idempotency_key mismatch`);
  assert(e.annotation_id === "ann-001", `annotation_id should be extracted from payload`);
  assert(e.session_id === "session-001", `session_id should be extracted from payload`);
  assert(e.worker_duration_ms === 42, `worker_duration_ms should be 42, got ${e.worker_duration_ms}`);
  assert(e.error_code === undefined, "No error_code on success");

  restoreFetch();
  pass("Successful job emits diagnostic with all contract fields populated");
}

// =============================================================================
// Test 2: Failed job (non-retryable) emits diagnostic
// =============================================================================

async function testFailedJobDiagnostic(): Promise<void> {
  const events: ApiJobDiagnosticEvent[] = [];

  mockFetch(() => new Response(JSON.stringify({
    job_id: "job-diag-002",
    status: "failed",
    result: null,
    duration_ms: 5,
    error: { code: "INVALID_INPUT", message: "Bad annotation data", retryable: false },
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const client = new WorkerClient({
    baseUrl: "http://localhost:8001",
    onDiagnostic: (e) => events.push(e),
  });

  const response = await client.submitJob(makeRequest({ job_id: "job-diag-002" }));

  assert(response.status === "failed", "Response should be failed");
  assert(events.length === 1, `Expected 1 diagnostic event, got ${events.length}`);

  const e = events[0]!;
  assert(e.status === "failed", `status should be failed, got ${e.status}`);
  assert(e.error_code === "INVALID_INPUT", `error_code should be INVALID_INPUT, got ${e.error_code}`);
  assert(e.error_message === "Bad annotation data", `error_message mismatch`);
  assert(e.retries === 0, "No retries for non-retryable error");
  assert(e.worker_duration_ms === 5, `worker_duration_ms should be 5, got ${e.worker_duration_ms}`);

  restoreFetch();
  pass("Failed job (non-retryable) emits diagnostic with error_code and error_message");
}

// =============================================================================
// Test 3: Retryable failure tracks retry count
// =============================================================================

async function testRetryCountTracking(): Promise<void> {
  const events: ApiJobDiagnosticEvent[] = [];
  let callCount = 0;

  mockFetch(() => {
    callCount++;
    if (callCount <= 2) {
      return new Response(JSON.stringify({
        job_id: "job-diag-003",
        status: "failed",
        result: null,
        duration_ms: 3,
        error: { code: "RATE_LIMIT", message: "Too many requests", retryable: true },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      job_id: "job-diag-003",
      status: "completed",
      result: { title: "Success after retries" },
      duration_ms: 15,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  // Override sleep to avoid waiting
  const client = new WorkerClient({
    baseUrl: "http://localhost:8001",
    onDiagnostic: (e) => events.push(e),
  });
  // Monkey-patch sleep for test speed
  (client as unknown as Record<string, unknown>)["sleep"] = () => Promise.resolve();

  await client.submitJob(makeRequest({ job_id: "job-diag-003" }));

  assert(events.length === 1, `Expected 1 final diagnostic event, got ${events.length}`);
  assert(events[0]!.retries === 2, `retries should be 2, got ${events[0]!.retries}`);
  assert(events[0]!.status === "completed", `Final status should be completed, got ${events[0]!.status}`);
  assert(callCount === 3, `Should have called fetch 3 times, got ${callCount}`);

  restoreFetch();
  pass("Retryable failure tracks retry count accurately (2 retries before success)");
}

// =============================================================================
// Test 4: Network error emits "network_error" status
// =============================================================================

async function testNetworkErrorDiagnostic(): Promise<void> {
  const events: ApiJobDiagnosticEvent[] = [];

  mockFetch(() => {
    throw new Error("Connection refused");
  });

  const client = new WorkerClient({
    baseUrl: "http://localhost:8001",
    onDiagnostic: (e) => events.push(e),
  });
  (client as unknown as Record<string, unknown>)["sleep"] = () => Promise.resolve();

  let threw = false;
  try {
    await client.submitJob(makeRequest({ job_id: "job-diag-004" }));
  } catch {
    threw = true;
  }

  assert(threw, "Should throw after all retries exhausted");
  assert(events.length === 1, `Expected 1 diagnostic event, got ${events.length}`);

  const e = events[0]!;
  assert(e.status === "network_error", `status should be network_error, got ${e.status}`);
  assert(e.error_code === "NETWORK_ERROR", `error_code should be NETWORK_ERROR, got ${e.error_code}`);
  assert(e.error_message === "Connection refused", `error_message should match`);
  assert(e.retries === 4, `retries should be 4 (initial + 3 retries), got ${e.retries}`);

  restoreFetch();
  pass("Network error emits diagnostic with 'network_error' status and retry count");
}

// =============================================================================
// Test 5: Timeout error emits "timeout" status
// =============================================================================

async function testTimeoutDiagnostic(): Promise<void> {
  const events: ApiJobDiagnosticEvent[] = [];

  mockFetch(() => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    throw err;
  });

  const client = new WorkerClient({
    baseUrl: "http://localhost:8001",
    onDiagnostic: (e) => events.push(e),
  });
  (client as unknown as Record<string, unknown>)["sleep"] = () => Promise.resolve();

  let threw = false;
  try {
    await client.submitJob(makeRequest({ job_id: "job-diag-005" }));
  } catch {
    threw = true;
  }

  assert(threw, "Should throw on timeout");
  assert(events.length === 1, `Expected 1 diagnostic event, got ${events.length}`);

  const e = events[0]!;
  assert(e.status === "timeout", `status should be timeout, got ${e.status}`);
  assert(e.error_code === "TIMEOUT", `error_code should be TIMEOUT, got ${e.error_code}`);

  restoreFetch();
  pass("Timeout emits diagnostic with 'timeout' status");
}

// =============================================================================
// Test 6: No callback → no crash
// =============================================================================

async function testNoDiagnosticCallback(): Promise<void> {
  mockFetch(() => new Response(JSON.stringify({
    job_id: "job-diag-006",
    status: "completed",
    result: { title: "No callback" },
    duration_ms: 10,
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const client = new WorkerClient({ baseUrl: "http://localhost:8001" });

  // Should not throw even without callback
  const response = await client.submitJob(makeRequest({ job_id: "job-diag-006" }));
  assert(response.status === "completed", "Should still return response");

  restoreFetch();
  pass("No diagnostic callback → no crash, job still works");
}

// =============================================================================
// Test 7: Diagnostic event shape matches ApiJobDiagnosticEvent contract
// =============================================================================

async function testDiagnosticEventShape(): Promise<void> {
  const events: ApiJobDiagnosticEvent[] = [];

  mockFetch(() => new Response(JSON.stringify({
    job_id: "job-diag-007",
    status: "completed",
    result: { title: "Shape check" },
    duration_ms: 20,
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const client = new WorkerClient({
    baseUrl: "http://localhost:8001",
    onDiagnostic: (e) => events.push(e),
  });

  await client.submitJob(makeRequest({
    job_id: "job-diag-007",
    job_type: "compile_bundle",
    payload: { session_id: "sess-007", annotations: [] },
    idempotency_key: "compile:sess-007",
  }));

  const e = events[0]!;

  // All required fields present
  const requiredFields = ["job_id", "job_type", "status", "duration_ms", "retries", "idempotency_key"];
  for (const field of requiredFields) {
    assert(field in e, `Missing required field: ${field}`);
  }

  // Types correct
  assert(typeof e.job_id === "string", "job_id should be string");
  assert(typeof e.job_type === "string", "job_type should be string");
  assert(typeof e.status === "string", "status should be string");
  assert(typeof e.duration_ms === "number", "duration_ms should be number");
  assert(typeof e.retries === "number", "retries should be number");
  assert(typeof e.idempotency_key === "string", "idempotency_key should be string");

  // Optional fields are undefined or correct type
  assert(e.error_code === undefined || typeof e.error_code === "string", "error_code should be string or undefined");
  assert(e.error_message === undefined || typeof e.error_message === "string", "error_message should be string or undefined");
  assert(e.worker_duration_ms === undefined || typeof e.worker_duration_ms === "number", "worker_duration_ms should be number or undefined");

  // Context extraction works for compile_bundle
  assert(e.session_id === "sess-007", `session_id should be sess-007, got ${e.session_id}`);
  assert(e.job_type === "compile_bundle", `job_type should be compile_bundle, got ${e.job_type}`);

  restoreFetch();
  pass("Diagnostic event shape matches ApiJobDiagnosticEvent contract exactly");
}

// =============================================================================
// Test 8: HTTP error (non-200) with retries
// =============================================================================

async function testHttpErrorDiagnostic(): Promise<void> {
  const events: ApiJobDiagnosticEvent[] = [];

  mockFetch(() => new Response("Internal Server Error", { status: 500 }));

  const client = new WorkerClient({
    baseUrl: "http://localhost:8001",
    onDiagnostic: (e) => events.push(e),
  });
  (client as unknown as Record<string, unknown>)["sleep"] = () => Promise.resolve();

  let threw = false;
  try {
    await client.submitJob(makeRequest({ job_id: "job-diag-008" }));
  } catch {
    threw = true;
  }

  assert(threw, "Should throw on HTTP 500 after retries");
  assert(events.length === 1, `Expected 1 diagnostic event, got ${events.length}`);

  const e = events[0]!;
  assert(e.status === "network_error", `status should be network_error for HTTP error, got ${e.status}`);
  assert(e.retries === 4, `Should have retried 4 times, got ${e.retries}`);

  restoreFetch();
  pass("HTTP 500 error treated as network_error with correct retry count");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Worker Diagnostics Tests ===\n");

const tests = [
  testSuccessfulJobDiagnostic,
  testFailedJobDiagnostic,
  testRetryCountTracking,
  testNetworkErrorDiagnostic,
  testTimeoutDiagnostic,
  testNoDiagnosticCallback,
  testDiagnosticEventShape,
  testHttpErrorDiagnostic,
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
