/**
 * Boundary validation — ensures reporter column selections never leak provenance fields.
 *
 * This is a compile-time + runtime check. If reporterBundleColumns ever includes
 * a forbidden column, this test fails.
 */

import { reporterBundleColumns, REPORTER_FORBIDDEN_COLUMNS } from "../select.js";

function assertReporterBoundary(): void {
  const reporterKeys = Object.keys(reporterBundleColumns);

  // Map camelCase keys to snake_case DB column names for comparison
  const camelToSnake = (s: string): string =>
    s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

  const reporterSnakeKeys = reporterKeys.map(camelToSnake);
  const forbidden = new Set<string>(REPORTER_FORBIDDEN_COLUMNS);

  const violations: string[] = [];
  for (const key of reporterSnakeKeys) {
    if (forbidden.has(key)) {
      violations.push(key);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `BOUNDARY VIOLATION: Reporter columns include forbidden fields: ${violations.join(", ")}`,
    );
  }

  // Verify specific provenance fields are absent
  const mustBeAbsent = ["exact_source", "resolved_component_stack", "severity", "acceptance_criteria"];
  for (const field of mustBeAbsent) {
    if (reporterSnakeKeys.includes(field)) {
      throw new Error(`BOUNDARY VIOLATION: Reporter MUST NOT include "${field}"`);
    }
  }

  console.log(
    `PASS: Reporter boundary check — ${reporterKeys.length} allowed columns, ${forbidden.size} forbidden columns excluded`,
  );
}

assertReporterBoundary();
