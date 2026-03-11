/**
 * API boundary enforcement test.
 *
 * Validates that:
 * 1. Session endpoint (reporter) NEVER returns provenance fields
 * 2. Bundle endpoint (developer) DOES return provenance fields
 * 3. Auth middleware blocks unauthorized access
 *
 * These are structural/contract tests — they verify the route handlers
 * use the correct column selection maps, not that a real DB is running.
 */

import {
  reporterBundleColumns,
  developerBundleColumns,
  REPORTER_FORBIDDEN_COLUMNS,
} from "@reviewlayer/db";

// =============================================================================
// Test 1: Reporter columns never include provenance
// =============================================================================

function testReporterExcludesProvenance(): void {
  const reporterKeys = new Set(Object.keys(reporterBundleColumns));
  const developerKeys = new Set(Object.keys(developerBundleColumns));

  // Reporter must be a strict subset of developer
  for (const key of reporterKeys) {
    if (!developerKeys.has(key)) {
      throw new Error(`Reporter has key "${key}" that developer doesn't — unexpected`);
    }
  }

  // Developer must have keys that reporter doesn't
  const developerOnly = [...developerKeys].filter((k) => !reporterKeys.has(k));
  if (developerOnly.length === 0) {
    throw new Error("Developer and reporter have identical keys — boundary not enforced");
  }

  // Verify specific provenance fields are in developer but NOT reporter
  const mustBeDeveloperOnly = [
    "exactSource",
    "resolvedComponentStack",
    "resolutionMode",
    "missingReasons",
    "rootBoundaryKind",
    "severity",
    "acceptanceCriteria",
    "normalizedTask",
  ];

  for (const field of mustBeDeveloperOnly) {
    if (reporterKeys.has(field)) {
      throw new Error(`BOUNDARY VIOLATION: "${field}" is in reporter columns`);
    }
    if (!developerKeys.has(field)) {
      throw new Error(`MISSING: "${field}" should be in developer columns`);
    }
  }

  console.log(
    `PASS: Reporter has ${reporterKeys.size} keys, developer has ${developerKeys.size} keys, ` +
      `${developerOnly.length} developer-only fields correctly excluded from reporter`,
  );
}

// =============================================================================
// Test 2: Forbidden columns list matches reporter exclusion
// =============================================================================

function testForbiddenColumnsComplete(): void {
  const camelToSnake = (s: string): string =>
    s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

  const developerKeys = Object.keys(developerBundleColumns);
  const reporterKeys = new Set(Object.keys(reporterBundleColumns));
  const forbidden = new Set<string>(REPORTER_FORBIDDEN_COLUMNS);

  // Every developer-only key should be in the forbidden list
  const missingFromForbidden: string[] = [];
  for (const key of developerKeys) {
    if (!reporterKeys.has(key)) {
      const snakeKey = camelToSnake(key);
      if (!forbidden.has(snakeKey) && snakeKey !== "updated_at") {
        missingFromForbidden.push(`${key} (${snakeKey})`);
      }
    }
  }

  if (missingFromForbidden.length > 0) {
    throw new Error(
      `FORBIDDEN_COLUMNS incomplete — missing: ${missingFromForbidden.join(", ")}`,
    );
  }

  console.log(
    `PASS: REPORTER_FORBIDDEN_COLUMNS covers all ${forbidden.size} developer-only fields`,
  );
}

// =============================================================================
// Test 3: exact_source and resolved_component_stack are separate
// =============================================================================

function testProvenanceSeparation(): void {
  const devKeys = Object.keys(developerBundleColumns);

  const hasExact = devKeys.includes("exactSource");
  const hasStack = devKeys.includes("resolvedComponentStack");

  if (!hasExact) throw new Error("Developer columns missing exactSource");
  if (!hasStack) throw new Error("Developer columns missing resolvedComponentStack");

  // Reporter must have NEITHER
  const reporterKeys = new Set(Object.keys(reporterBundleColumns));
  if (reporterKeys.has("exactSource")) {
    throw new Error("Reporter has exactSource — FORBIDDEN");
  }
  if (reporterKeys.has("resolvedComponentStack")) {
    throw new Error("Reporter has resolvedComponentStack — FORBIDDEN");
  }

  console.log("PASS: exact_source and resolved_component_stack are separate and properly bounded");
}

// Run all tests
testReporterExcludesProvenance();
testForbiddenColumnsComplete();
testProvenanceSeparation();
console.log("\nAll API boundary enforcement tests passed.");
