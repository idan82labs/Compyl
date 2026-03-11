/**
 * Worker error rate alerting tests.
 *
 * WHAT THIS PROVES:
 * - Error rate computed correctly from sliding window
 * - Alert fires when error rate crosses configured threshold (>5%)
 * - Alert does NOT fire below threshold
 * - Minimum sample size prevents false alarms on sparse traffic
 * - Sliding window expiry drops old events (no permanent memory bloat)
 * - Recovery event fires when rate drops below threshold after alert
 * - Tracker correctly classifies completed/partial as success, everything else as failure
 *
 * HOW: Creates WorkerErrorRateTracker with test-friendly configs,
 * feeds it synthetic ApiJobDiagnosticEvent records, verifies alert behavior.
 */

import { WorkerErrorRateTracker } from "../worker-error-rate.js";
import type { ApiJobDiagnosticEvent, WorkerErrorRateAlert } from "@reviewlayer/contracts";

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

function makeEvent(
  status: ApiJobDiagnosticEvent["status"],
  overrides?: Partial<ApiJobDiagnosticEvent>,
): ApiJobDiagnosticEvent {
  return {
    job_id: `job-${Math.random().toString(36).slice(2, 8)}`,
    job_type: "summarize_annotation",
    status,
    duration_ms: 50,
    retries: 0,
    idempotency_key: `key-${Date.now()}`,
    ...overrides,
  };
}

// =============================================================================
// Test 1: No alert when below threshold
// =============================================================================

function testNoAlertBelowThreshold(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.05,
    windowMs: 60_000,
    minSampleSize: 10,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // 10 successes, 0 failures = 0% error rate
  for (let i = 0; i < 10; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }

  assert(alerts.length === 0, `Expected 0 alerts, got ${alerts.length}`);
  assert(!tracker.isAlertActive, "Alert should not be active");

  pass("No alert when all jobs succeed (0% error rate)");
}

// =============================================================================
// Test 2: Alert fires when threshold crossed
// =============================================================================

function testAlertFiresAtThreshold(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.05,
    windowMs: 60_000,
    minSampleSize: 10,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // 9 successes + 1 failure = 10% error rate (>5% threshold)
  for (let i = 0; i < 9; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }
  tracker.recordAt(makeEvent("failed"), now + 9);

  assert(alerts.length === 1, `Expected 1 alert, got ${alerts.length}`);

  const alert = alerts[0]!;
  assert(alert.error_rate === 0.1, `Error rate should be 0.1 (10%), got ${alert.error_rate}`);
  assert(alert.threshold === 0.05, `Threshold should be 0.05, got ${alert.threshold}`);
  assert(alert.total_jobs === 10, `Total jobs should be 10, got ${alert.total_jobs}`);
  assert(alert.failed_jobs === 1, `Failed jobs should be 1, got ${alert.failed_jobs}`);
  assert(alert.recovered === false, "Should not be a recovery event");
  assert(tracker.isAlertActive, "Alert should be active");

  pass("Alert fires when error rate (10%) exceeds threshold (5%)");
}

// =============================================================================
// Test 3: Minimum sample size prevents false alarms
// =============================================================================

function testMinSampleSizePrevention(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.05,
    windowMs: 60_000,
    minSampleSize: 10,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // 1 failure out of 1 = 100% error rate, but only 1 sample
  tracker.recordAt(makeEvent("failed"), now);

  assert(alerts.length === 0, `Expected 0 alerts with only 1 sample, got ${alerts.length}`);

  // Add 4 more failures = 5 samples, still below minSampleSize of 10
  for (let i = 1; i < 5; i++) {
    tracker.recordAt(makeEvent("failed"), now + i);
  }

  assert(alerts.length === 0, `Expected 0 alerts with 5 samples, got ${alerts.length}`);

  pass("Minimum sample size (10) prevents false alarms on sparse traffic");
}

// =============================================================================
// Test 4: Alert fires once, not repeatedly
// =============================================================================

function testAlertFiresOnce(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.05,
    windowMs: 60_000,
    minSampleSize: 5,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // 4 successes + 1 failure = 20% error rate
  for (let i = 0; i < 4; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }
  tracker.recordAt(makeEvent("failed"), now + 4);

  assert(alerts.length === 1, "First alert should fire");

  // Add more failures — should NOT fire again
  for (let i = 5; i < 8; i++) {
    tracker.recordAt(makeEvent("failed"), now + i);
  }

  assert(alerts.length === 1, `Alert should not fire again while active, got ${alerts.length}`);

  pass("Alert fires once and does not repeat while active");
}

// =============================================================================
// Test 5: Recovery event when rate drops below threshold
// =============================================================================

function testRecoveryEvent(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.10, // 10% threshold for easier testing
    windowMs: 60_000,
    minSampleSize: 5,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // Trigger alert: 3 successes + 2 failures = 40% error rate
  for (let i = 0; i < 3; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }
  tracker.recordAt(makeEvent("failed"), now + 3);
  tracker.recordAt(makeEvent("failed"), now + 4);

  assert(alerts.length === 1, "Alert should fire");
  assert(alerts[0]!.recovered === false, "First alert should not be recovery");

  // Now add many successes to bring rate below 10%
  // Current: 3 success + 2 fail = 40%. Need rate <= 10%.
  // After adding N successes: 2/(5+N) <= 0.10 → N >= 15
  for (let i = 5; i < 20; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }

  assert(alerts.length === 2, `Expected recovery alert (2 total), got ${alerts.length}`);
  const recovery = alerts[1]!;
  assert(recovery.recovered === true, "Second alert should be recovery event");
  assert(recovery.error_rate <= 0.10, `Recovery error rate should be <= 0.10, got ${recovery.error_rate}`);
  assert(!tracker.isAlertActive, "Alert should no longer be active after recovery");

  pass("Recovery event fires when error rate drops below threshold");
}

// =============================================================================
// Test 6: Sliding window expiry drops old events
// =============================================================================

function testWindowExpiry(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.05,
    windowMs: 1_000, // 1 second window for testing
    minSampleSize: 5,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // Add 5 failures at time=now (will trigger alert)
  for (let i = 0; i < 5; i++) {
    tracker.recordAt(makeEvent("failed"), now + i);
  }

  assert(alerts.length === 1, "Alert should fire with 100% error rate");

  // Add 5 successes at now + 2000 (old failures should have expired from the 1s window)
  for (let i = 0; i < 5; i++) {
    tracker.recordAt(makeEvent("completed"), now + 2000 + i);
  }

  // Recovery should fire because old failures expired
  assert(alerts.length === 2, `Expected recovery after window expiry, got ${alerts.length}`);
  assert(alerts[1]!.recovered === true, "Should be recovery event after window expiry");

  pass("Sliding window expiry drops old events — failures expire after windowMs");
}

// =============================================================================
// Test 7: Status classification (completed/partial = success, rest = failure)
// =============================================================================

function testStatusClassification(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.05,
    windowMs: 60_000,
    minSampleSize: 10,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // 5 completed + 3 partial + 2 failed = 10 total, 20% error rate
  for (let i = 0; i < 5; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }
  for (let i = 5; i < 8; i++) {
    tracker.recordAt(makeEvent("partial"), now + i);
  }
  tracker.recordAt(makeEvent("failed"), now + 8);
  tracker.recordAt(makeEvent("network_error"), now + 9);

  assert(alerts.length === 1, `Expected 1 alert, got ${alerts.length}`);
  assert(alerts[0]!.failed_jobs === 2, `Failed jobs should be 2 (failed + network_error), got ${alerts[0]!.failed_jobs}`);
  assert(alerts[0]!.total_jobs === 10, `Total jobs should be 10, got ${alerts[0]!.total_jobs}`);
  assert(alerts[0]!.error_rate === 0.2, `Error rate should be 0.2, got ${alerts[0]!.error_rate}`);

  pass("Status classification: completed/partial = success; failed/network_error/timeout = failure");
}

// =============================================================================
// Test 8: Timeout status counted as failure
// =============================================================================

function testTimeoutCountedAsFailure(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.05,
    windowMs: 60_000,
    minSampleSize: 10,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // 9 successes + 1 timeout = 10% error rate
  for (let i = 0; i < 9; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }
  tracker.recordAt(makeEvent("timeout"), now + 9);

  assert(alerts.length === 1, `Expected 1 alert for timeout failure, got ${alerts.length}`);
  assert(alerts[0]!.failed_jobs === 1, `Failed jobs should count timeout, got ${alerts[0]!.failed_jobs}`);

  pass("Timeout status counted as failure in error rate calculation");
}

// =============================================================================
// Test 9: Custom threshold respected
// =============================================================================

function testCustomThreshold(): void {
  const alerts: WorkerErrorRateAlert[] = [];

  const tracker = new WorkerErrorRateTracker({
    threshold: 0.20, // 20% threshold
    windowMs: 60_000,
    minSampleSize: 5,
    onAlert: (a) => alerts.push(a),
  });

  const now = Date.now();

  // 4 successes + 1 failure = 20% error rate — exactly at threshold, should NOT alert
  for (let i = 0; i < 4; i++) {
    tracker.recordAt(makeEvent("completed"), now + i);
  }
  tracker.recordAt(makeEvent("failed"), now + 4);

  assert(alerts.length === 0, `20% rate at 20% threshold should NOT alert (must be >), got ${alerts.length}`);

  // Add one more failure = 2/6 = 33.3% > 20%
  tracker.recordAt(makeEvent("failed"), now + 5);

  assert(alerts.length === 1, `33% rate at 20% threshold SHOULD alert, got ${alerts.length}`);
  assert(alerts[0]!.threshold === 0.20, `Threshold should be 0.20, got ${alerts[0]!.threshold}`);

  pass("Custom threshold (20%) respected — alert only when strictly exceeded");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Worker Error Rate Alerting Tests ===\n");

const tests = [
  testNoAlertBelowThreshold,
  testAlertFiresAtThreshold,
  testMinSampleSizePrevention,
  testAlertFiresOnce,
  testRecoveryEvent,
  testWindowExpiry,
  testStatusClassification,
  testTimeoutCountedAsFailure,
  testCustomThreshold,
];

for (const test of tests) {
  try {
    test();
  } catch (err) {
    failed++;
    console.error(`FAIL: ${test.name} — ${(err as Error).message}`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
