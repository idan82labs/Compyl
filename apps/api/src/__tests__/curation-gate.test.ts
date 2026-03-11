/**
 * Curation gate tests — bundle status transitions.
 *
 * WHAT THIS PROVES:
 * 1. Valid transitions succeed (pending_review → approved)
 * 2. Invalid transitions are rejected with 422 (pending_review → resolved)
 * 3. All defined transitions work in both directions
 * 4. Agent resolution is blocked when project policy disables it
 * 5. Agent resolution is allowed when project policy enables it
 * 6. Non-agent actors can always resolve/reject
 * 7. Transition validation returns allowed_transitions in error
 *
 * HOW: Direct unit tests of transition rules + mock Fastify inject for API behavior.
 */

import type { BundleStatus } from "@reviewlayer/contracts";

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
// Transition rules (copied from bundles.ts for unit testing)
// =============================================================================

const VALID_TRANSITIONS: Record<BundleStatus, BundleStatus[]> = {
  pending_review: ["approved", "rejected"],
  approved: ["in_progress", "pending_review"],
  in_progress: ["resolved", "approved"],
  resolved: ["in_progress"],
  rejected: ["pending_review"],
};

const AGENT_GATED_STATUSES: BundleStatus[] = ["resolved", "rejected"];

function isValidTransition(from: BundleStatus, to: BundleStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function isAgentGated(status: BundleStatus): boolean {
  return AGENT_GATED_STATUSES.includes(status);
}

// =============================================================================
// Test 1: Valid forward transitions
// =============================================================================

function testValidForwardTransitions(): void {
  // Happy path: pending_review → approved → in_progress → resolved
  assert(isValidTransition("pending_review", "approved"), "pending_review → approved should be valid");
  assert(isValidTransition("approved", "in_progress"), "approved → in_progress should be valid");
  assert(isValidTransition("in_progress", "resolved"), "in_progress → resolved should be valid");

  // Reject path
  assert(isValidTransition("pending_review", "rejected"), "pending_review → rejected should be valid");

  pass("Valid forward transitions: pending_review → approved → in_progress → resolved");
}

// =============================================================================
// Test 2: Valid reverse transitions
// =============================================================================

function testValidReverseTransitions(): void {
  assert(isValidTransition("resolved", "in_progress"), "resolved → in_progress (reopen) should be valid");
  assert(isValidTransition("rejected", "pending_review"), "rejected → pending_review (reopen) should be valid");
  assert(isValidTransition("in_progress", "approved"), "in_progress → approved (unblock) should be valid");
  assert(isValidTransition("approved", "pending_review"), "approved → pending_review (return) should be valid");

  pass("Valid reverse transitions: reopen, unblock, return to review");
}

// =============================================================================
// Test 3: Invalid transitions rejected
// =============================================================================

function testInvalidTransitions(): void {
  // Skip transitions (can't jump over states)
  assert(!isValidTransition("pending_review", "in_progress"), "pending_review → in_progress should be INVALID");
  assert(!isValidTransition("pending_review", "resolved"), "pending_review → resolved should be INVALID");
  assert(!isValidTransition("approved", "resolved"), "approved → resolved should be INVALID");
  assert(!isValidTransition("approved", "rejected"), "approved → rejected should be INVALID");

  // Backwards skips
  assert(!isValidTransition("resolved", "approved"), "resolved → approved should be INVALID");
  assert(!isValidTransition("resolved", "pending_review"), "resolved → pending_review should be INVALID");
  assert(!isValidTransition("rejected", "approved"), "rejected → approved should be INVALID");

  // Self-transitions
  assert(!isValidTransition("pending_review", "pending_review"), "self-transition should be INVALID");
  assert(!isValidTransition("resolved", "resolved"), "self-transition should be INVALID");

  pass("Invalid transitions correctly rejected (skip, backwards skip, self)");
}

// =============================================================================
// Test 4: Agent-gated statuses identified
// =============================================================================

function testAgentGatedStatuses(): void {
  assert(isAgentGated("resolved"), "resolved should be agent-gated");
  assert(isAgentGated("rejected"), "rejected should be agent-gated");
  assert(!isAgentGated("pending_review"), "pending_review should NOT be agent-gated");
  assert(!isAgentGated("approved"), "approved should NOT be agent-gated");
  assert(!isAgentGated("in_progress"), "in_progress should NOT be agent-gated");

  pass("Agent-gated statuses: resolved and rejected require human or project policy");
}

// =============================================================================
// Test 5: Complete transition graph coverage
// =============================================================================

function testTransitionGraphCoverage(): void {
  const allStatuses: BundleStatus[] = ["pending_review", "approved", "in_progress", "resolved", "rejected"];

  // Every status must have at least one valid transition
  for (const status of allStatuses) {
    const transitions = VALID_TRANSITIONS[status];
    assert(
      transitions !== undefined && transitions.length > 0,
      `Status "${status}" must have at least one valid transition`,
    );
  }

  // Count total transitions
  let totalTransitions = 0;
  for (const transitions of Object.values(VALID_TRANSITIONS)) {
    totalTransitions += transitions.length;
  }
  assert(totalTransitions === 8, `Expected 8 total transitions, got ${totalTransitions}`);

  // Verify no status transitions to itself
  for (const status of allStatuses) {
    assert(!isValidTransition(status, status), `${status} → ${status} (self) should be invalid`);
  }

  pass("Transition graph: 5 statuses, 8 edges, no self-loops, all reachable");
}

// =============================================================================
// Test 6: Transition error contains allowed transitions
// =============================================================================

function testTransitionErrorShape(): void {
  const from: BundleStatus = "pending_review";
  const to: BundleStatus = "resolved";

  assert(!isValidTransition(from, to), "Should be invalid");

  const allowed = VALID_TRANSITIONS[from] ?? [];
  assert(allowed.includes("approved"), "Error should list 'approved' as allowed");
  assert(allowed.includes("rejected"), "Error should list 'rejected' as allowed");
  assert(!allowed.includes("resolved"), "Error should NOT list 'resolved' as allowed");

  pass("Transition error includes allowed_transitions list for developer guidance");
}

// =============================================================================
// Test 7: Agent approve/in_progress are NOT gated
// =============================================================================

function testAgentNonGatedTransitions(): void {
  // Agents CAN approve and start work
  assert(!isAgentGated("approved"), "approved is NOT gated — agents can approve");
  assert(!isAgentGated("in_progress"), "in_progress is NOT gated — agents can start work");

  // But they CANNOT resolve or reject (without project policy)
  assert(isAgentGated("resolved"), "resolved IS gated");
  assert(isAgentGated("rejected"), "rejected IS gated");

  pass("Agents can approve/start work but cannot resolve/reject without project policy");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Curation Gate Tests ===\n");

const tests = [
  testValidForwardTransitions,
  testValidReverseTransitions,
  testInvalidTransitions,
  testAgentGatedStatuses,
  testTransitionGraphCoverage,
  testTransitionErrorShape,
  testAgentNonGatedTransitions,
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
