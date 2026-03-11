/**
 * Column selection maps for DTO trust boundaries.
 *
 * These enforce that reporters NEVER see provenance fields and
 * developers see the full technical context.
 *
 * Usage:
 *   import { reporterBundleColumns, developerBundleColumns } from "@compyl/db";
 *   db.select(reporterBundleColumns).from(executionBundles);
 */

import { executionBundles } from "./schema.js";

// =============================================================================
// Reporter — NO provenance, NO severity, NO acceptance criteria, NO file paths
// =============================================================================

/**
 * Reporter-safe column selection for execution_bundles.
 * Excludes: exact_source, resolved_component_stack, resolution_mode,
 * missing_reasons, root_boundary_kind, design_diff, severity,
 * acceptance_criteria, constraints, validation_steps, confidence,
 * unresolved_ambiguities, component_candidates, file_candidates,
 * design_candidates, dom_selector, computed_styles, normalized_task,
 * assignee_id, assignee_type, branch, commit_sha, build_url.
 */
export const reporterBundleColumns = {
  id: executionBundles.id,
  title: executionBundles.title,
  summary: executionBundles.summary,
  category: executionBundles.category,
  screenshotUrl: executionBundles.screenshotUrl,
  clientRawText: executionBundles.clientRawText,
  referenceImages: executionBundles.referenceImages,
  status: executionBundles.status,
  createdAt: executionBundles.createdAt,
} as const;

// =============================================================================
// Developer — full technical context including provenance (ALWAYS SEPARATE)
// =============================================================================

/**
 * Developer column selection for execution_bundles.
 * Includes exact_source and resolved_component_stack as SEPARATE fields.
 */
export const developerBundleColumns = {
  id: executionBundles.id,
  title: executionBundles.title,
  summary: executionBundles.summary,
  normalizedTask: executionBundles.normalizedTask,
  category: executionBundles.category,
  severity: executionBundles.severity,
  pageUrl: executionBundles.pageUrl,
  viewport: executionBundles.viewport,
  screenshotUrl: executionBundles.screenshotUrl,
  domSelector: executionBundles.domSelector,
  computedStyles: executionBundles.computedStyles,
  clientRawText: executionBundles.clientRawText,
  referenceImages: executionBundles.referenceImages,

  // Provenance — ALWAYS SEPARATE
  exactSource: executionBundles.exactSource,
  resolvedComponentStack: executionBundles.resolvedComponentStack,
  resolutionMode: executionBundles.resolutionMode,
  missingReasons: executionBundles.missingReasons,
  rootBoundaryKind: executionBundles.rootBoundaryKind,

  // Derived
  componentCandidates: executionBundles.componentCandidates,
  fileCandidates: executionBundles.fileCandidates,
  designCandidates: executionBundles.designCandidates,
  designDiff: executionBundles.designDiff,

  // Build context
  branch: executionBundles.branch,
  commitSha: executionBundles.commitSha,
  buildUrl: executionBundles.buildUrl,

  // AI-generated
  acceptanceCriteria: executionBundles.acceptanceCriteria,
  constraints: executionBundles.constraints,
  confidence: executionBundles.confidence,
  unresolvedAmbiguities: executionBundles.unresolvedAmbiguities,
  validationSteps: executionBundles.validationSteps,

  // Lifecycle
  status: executionBundles.status,
  assigneeType: executionBundles.assigneeType,
  assigneeId: executionBundles.assigneeId,
  createdAt: executionBundles.createdAt,
  updatedAt: executionBundles.updatedAt,
} as const;

// =============================================================================
// Provenance-forbidden fields (for compile-time and runtime boundary checks)
// =============================================================================

/**
 * Column names that reporters must NEVER see.
 * Used for runtime validation in API middleware.
 */
export const REPORTER_FORBIDDEN_COLUMNS = [
  "exact_source",
  "resolved_component_stack",
  "resolution_mode",
  "missing_reasons",
  "root_boundary_kind",
  "normalized_task",
  "severity",
  "design_diff",
  "acceptance_criteria",
  "constraints",
  "confidence",
  "unresolved_ambiguities",
  "validation_steps",
  "component_candidates",
  "file_candidates",
  "design_candidates",
  "page_url",
  "viewport",
  "dom_selector",
  "computed_styles",
  "branch",
  "commit_sha",
  "build_url",
  "annotation_coordinates",
  "assignee_type",
  "assignee_id",
  "updated_at",
] as const;

/**
 * Columns that agents cannot mutate (reviewer-side state).
 * Agents can READ everything but can only WRITE to designated fields.
 */
export const AGENT_IMMUTABLE_COLUMNS = [
  "summary",
  "client_raw_text",
  "reference_images",
  "screenshot_url",
] as const;
