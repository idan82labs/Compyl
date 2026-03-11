/**
 * @reviewlayer/contracts
 *
 * Single source of truth for all shared types across the Compyl system.
 * Every package imports from here — no ad-hoc type definitions allowed.
 *
 * NAMING DISCIPLINE:
 * - `exact_source` / `ExactSource` — build-time leaf/render-site from data-rl-source. Always a single frame.
 * - `resolved_component_stack` / `ResolvedComponentFrame` — runtime ancestry from fiber walk + __rlMeta. Always an array.
 * - These are NEVER blurred into a generic "component stack" or "source stack".
 */

// =============================================================================
// Provenance primitives
// =============================================================================

/** How the component stack was resolved for this item. */
export type ResolutionMode =
  | "fiber_meta" // full fiber walk with __rlMeta available
  | "server_prefix" // server-rendered prefix with limited ancestry
  | "leaf_only" // only exact_source available, no ancestry recovered
  | "heuristic"; // DOM structure / class-based guessing (lowest confidence)

/** What kind of source line a frame represents. */
export type LineKind =
  | "leaf-dom" // exact DOM-emitting JSX site
  | "definition" // component definition location (default for ancestor frames)
  | "callsite"; // exact parent callsite (deep mode only)

/** Why ancestry stopped or is incomplete. */
export type RootBoundaryKind = "portal" | "separate_root" | "rsc_client_boundary";

// =============================================================================
// Exact Source (build-time, from data-rl-source)
// =============================================================================

/**
 * Exact leaf/render-site source. Produced at build time by the SWC/Babel plugin.
 * This is a SINGLE frame — never an array. Always high confidence when present.
 */
export interface ExactSource {
  file_path: string;
  component_name: string;
  line: number;
  line_kind: "leaf-dom"; // always leaf-dom for exact source
}

// =============================================================================
// Resolved Component Stack (runtime, from fiber walk + __rlMeta)
// =============================================================================

/**
 * A single frame in the runtime-resolved ancestry.
 * Produced on click via the versioned React adapter.
 */
export interface ResolvedComponentFrame {
  component_name: string;
  file_path?: string; // may be absent for uninstrumented third-party components
  line?: number;
  line_kind: LineKind;
  is_library: boolean;
  confidence?: number; // 0-1, absent means high confidence
}

// =============================================================================
// Build plugin metadata
// =============================================================================

/** Metadata attached to instrumented component exports at build time. */
export interface RlMeta {
  id: number;
  name: string;
  file: string;
  line: number;
  isLibrary: boolean;
}

// =============================================================================
// ExecutionBundle — the system-of-record object
// =============================================================================

export type FeedbackCategory =
  | "visual_bug"
  | "layout_issue"
  | "copy_change"
  | "feature_request"
  | "behavior_bug"
  | "accessibility"
  | "performance";

export type Severity = "critical" | "major" | "minor" | "suggestion";

export type BundleStatus = "pending_review" | "approved" | "in_progress" | "resolved" | "rejected";

export type AssigneeType = "human" | "agent" | "unassigned";

export interface Viewport {
  width: number;
  height: number;
  scroll_x: number;
  scroll_y: number;
  device_preset?: string;
  css_breakpoint?: string;
}

export interface ConfidenceScores {
  component_match: number; // 0-1
  design_match: number; // 0-1
  task_clarity: number; // 0-1
}

export interface DesignCandidate {
  component_id: string;
  component_name: string;
  confidence: number;
  /** True when resolved via Code Connect (identity resolution, not ranking). */
  is_code_connect?: boolean;
  /** Signals that contributed to this candidate's ranking. */
  ranking_signals?: RankingSignal[];
}

/** A single signal used during Figma candidate ranking. */
export interface RankingSignal {
  /** Signal type identifier. */
  signal: string;
  /** How much this signal contributed (0-1). */
  weight: number;
  /** Whether this signal matched. */
  matched: boolean;
  /** Human-readable detail. */
  detail?: string;
}

/** Figma component metadata used for candidate matching. */
export interface FigmaComponentInfo {
  /** Figma node ID (e.g. "1:23"). */
  node_id: string;
  /** Component name in Figma. */
  name: string;
  /** Component description from Figma. */
  description?: string;
  /** Containing page name. */
  page_name?: string;
  /** Key from publishable component library. */
  component_key?: string;
  /** Variant properties if any. */
  variant_properties?: Record<string, string>;
}

/** Code Connect mapping: maps a codebase component to a Figma component. */
export interface CodeConnectMapping {
  /** Codebase component name (e.g. "Button"). */
  code_component: string;
  /** File path in codebase (e.g. "src/components/Button.tsx"). */
  code_file?: string;
  /** Figma component node ID. */
  figma_node_id: string;
  /** Figma component name. */
  figma_component_name: string;
}

/** Full result of a Figma candidate ranking operation. */
export interface FigmaRankingResult {
  /** Ranked candidates (highest confidence first). */
  candidates: DesignCandidate[];
  /** Whether Code Connect was used for identity resolution. */
  code_connect_resolved: boolean;
  /** The trace event for this ranking operation. */
  trace: FigmaRankingTraceEvent;
  /** Whether a design diff should be computed (only for high-confidence matches). */
  should_compute_diff: boolean;
}

export interface ExternalExportRef {
  service: string;
  issue_id: string;
  url: string;
}

export interface ComponentCandidate {
  component_name: string;
  file_path?: string;
  confidence: number;
  source: "exact_source" | "ancestry" | "heuristic";
}

/**
 * The ExecutionBundle — Compyl's central data object.
 * Every feedback item produces one. Rendered into reporter summary,
 * developer task, and agent-ready execution context.
 *
 * `exact_source` and `resolved_component_stack` are ALWAYS separate fields.
 */
export interface ExecutionBundle {
  id: string; // UUID
  schema_version: string;
  title: string;
  summary: string; // plain-language, reporter-safe
  normalized_task: string; // precise, for developers and agents
  category: FeedbackCategory;
  severity: Severity;
  page_url: string;
  viewport: Viewport;
  screenshot_url: string;
  annotation_coordinates: Record<string, unknown>;
  dom_selector: string;
  computed_styles: Record<string, string>;
  client_raw_text: string;
  reference_images: string[];

  // --- Provenance (ALWAYS separate) ---
  exact_source: ExactSource | null;
  resolved_component_stack: ResolvedComponentFrame[];
  resolution_mode: ResolutionMode;
  missing_reasons: string[];
  root_boundary_kind: RootBoundaryKind | null;

  // --- Derived suggestions ---
  component_candidates: ComponentCandidate[];
  file_candidates: string[];
  design_candidates: DesignCandidate[];
  design_diff: Record<string, unknown> | null;

  // --- Context ---
  branch: string;
  commit_sha: string;
  build_url: string | null;

  // --- AI-generated ---
  acceptance_criteria: string[];
  constraints: string[];
  confidence: ConfidenceScores;
  unresolved_ambiguities: string[];
  validation_steps: string[];

  // --- Lifecycle ---
  status: BundleStatus;
  assignee_type: AssigneeType;
  assignee_id: string | null;
  created_at: string; // ISO 8601
  exported_to: ExternalExportRef[];
}

// =============================================================================
// DTOs — trust-boundary-scoped views of the bundle
// =============================================================================

/**
 * Reporter DTO — what non-technical reviewers see.
 * NO file paths, NO component ancestry, NO design diffs, NO severity internals.
 */
export interface ReporterDTO {
  id: string;
  title: string;
  summary: string;
  category_label: string; // human-readable, not enum
  screenshot_url: string;
  client_raw_text: string;
  reference_images: string[];
  status: BundleStatus;
  created_at: string;
  // Clarification fields
  clarification_question?: string;
  clarification_options?: string[];
}

/**
 * Developer DTO — full technical context.
 * Includes SEPARATE exact_source and resolved_component_stack.
 */
export interface DeveloperDTO {
  id: string;
  title: string;
  summary: string;
  normalized_task: string;
  category: FeedbackCategory;
  severity: Severity;
  page_url: string;
  viewport: Viewport;
  screenshot_url: string;
  dom_selector: string;
  computed_styles: Record<string, string>;
  client_raw_text: string;
  reference_images: string[];

  // Provenance (always separate)
  exact_source: ExactSource | null;
  resolved_component_stack: ResolvedComponentFrame[];
  resolution_mode: ResolutionMode;
  missing_reasons: string[];
  root_boundary_kind: RootBoundaryKind | null;

  component_candidates: ComponentCandidate[];
  file_candidates: string[];
  design_candidates: DesignCandidate[];
  design_diff: Record<string, unknown> | null;

  branch: string;
  commit_sha: string;
  build_url: string | null;
  acceptance_criteria: string[];
  constraints: string[];
  confidence: ConfidenceScores;
  unresolved_ambiguities: string[];
  validation_steps: string[];

  status: BundleStatus;
  assignee_type: AssigneeType;
  assignee_id: string | null;
  created_at: string;
  exported_to: ExternalExportRef[];
}

/**
 * Agent DTO — full ExecutionBundle for machine consumption.
 */
export type AgentDTO = ExecutionBundle;

// =============================================================================
// API ↔ Worker job contract
// =============================================================================

export type WorkerJobType =
  | "summarize_annotation"
  | "generate_clarification"
  | "enrich_bundle"
  | "compute_design_diff"
  | "compile_bundle"
  | "generate_acceptance_criteria";

export type WorkerJobStatus = "completed" | "failed" | "partial";

export interface WorkerJobRequest<T = unknown> {
  job_id: string; // UUID
  job_type: WorkerJobType;
  payload: T;
  idempotency_key: string;
  created_at: string; // ISO 8601
}

export interface WorkerJobError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface WorkerJobResponse<T = unknown> {
  job_id: string;
  status: WorkerJobStatus;
  result: T;
  error?: WorkerJobError;
  duration_ms: number;
}

// =============================================================================
// Observability event types
// =============================================================================

export interface ResolutionTelemetryEvent {
  resolution_mode: ResolutionMode;
  frame_count: number;
  missing_reasons: string[];
  exact_source_available: boolean;
  duration_ms: number;
}

export interface AdapterFailureEvent {
  react_version: string;
  failure_type: string;
  fallback_mode: ResolutionMode;
  fiber_depth_reached: number;
}

export interface FigmaRankingTraceEvent {
  candidate_count: number;
  top_confidence: number;
  ranking_signals_used: string[];
  code_connect_available: boolean;
  duration_ms: number;
  /** Bundle ID this ranking was performed for. */
  bundle_id?: string;
  /** All candidates considered (node_id + name + confidence). */
  candidate_list?: Array<{ node_id: string; name: string; confidence: number }>;
  /** Why the top candidate was selected (or why no match). */
  ranking_reason?: string;
  /** True when ranking produced no usable match. */
  no_match?: boolean;
  /** Fallback strategy used when primary ranking fails. */
  fallback_used?: string;
}

/** Worker-side diagnostic event (emitted by Python worker). */
export interface WorkerJobDiagnosticEvent {
  job_type: WorkerJobType;
  duration_ms: number;
  status: WorkerJobStatus;
  error_code?: string;
  model_used: string;
  token_count: number;
  retries: number;
}

/** API-side diagnostic event (emitted by WorkerClient on every job). */
export interface ApiJobDiagnosticEvent {
  job_id: string;
  job_type: WorkerJobType;
  status: WorkerJobStatus | "network_error" | "timeout";
  duration_ms: number;
  retries: number;
  error_code?: string;
  error_message?: string;
  idempotency_key: string;
  session_id?: string;
  annotation_id?: string;
  worker_duration_ms?: number;
}

/** Alert emitted when worker error rate exceeds threshold. */
export interface WorkerErrorRateAlert {
  error_rate: number; // 0-1, current rate in the window
  threshold: number; // configured threshold (e.g. 0.05)
  window_ms: number; // sliding window size in ms
  total_jobs: number; // jobs in current window
  failed_jobs: number; // failures in current window
  recovered: boolean; // true when rate drops below threshold after alert
}

// =============================================================================
// Agent action audit trail
// =============================================================================

/** Agent token permission level. Mirrors the DB enum. */
export type AgentTokenPermission = "read" | "readwrite" | "full";

/** What kind of actor performed the action. */
export type AgentActorType = "agent" | "human" | "system";

/** Surface through which the action was performed. */
export type AgentActionSource = "mcp" | "cli" | "api" | "ui";

/** Outcome of the action. */
export type AgentActionStatus = "success" | "error" | "denied";

/**
 * Structured audit event for every agent/tool/CLI action.
 * Emitted by MCP server, CLI, and API for the Agent Activity surface.
 *
 * Design: every action is attributable (who), describable (what),
 * targetable (on what), and correlatable (to which job/session/request).
 */
export interface AgentAction {
  id: string; // UUID
  timestamp: string; // ISO 8601

  // Who
  actor_type: AgentActorType;
  actor_id?: string; // agent token ID, user ID, or "system"

  // What
  source: AgentActionSource;
  action: string; // tool name or CLI command (e.g. "get_bundle", "pull")
  payload: Record<string, unknown>; // input parameters

  // On what
  target_entity_type?: string; // "bundle", "session", "project"
  target_entity_id?: string; // UUID of the target

  // Outcome
  status: AgentActionStatus;
  error_code?: string;
  error_message?: string;
  duration_ms: number;

  // Correlation
  request_id?: string; // HTTP request or MCP request ID
  job_id?: string; // worker job ID if action triggered a job
  session_id?: string; // review session context
  project_id?: string; // project context
}

// =============================================================================
// MCP tool/resource payload types
// =============================================================================

/** Input for list_bundles MCP tool. */
export interface McpListBundlesInput {
  project_id: string;
  status?: BundleStatus;
  severity?: Severity;
  category?: FeedbackCategory;
  limit?: number; // default 50, max 200
  offset?: number;
}

/** Input for get_bundle MCP tool. */
export interface McpGetBundleInput {
  bundle_id: string;
}

/** Input for update_bundle_status MCP tool. */
export interface McpUpdateBundleStatusInput {
  bundle_id: string;
  status: BundleStatus;
  reason?: string;
}

/** Input for assign_bundle MCP tool. */
export interface McpAssignBundleInput {
  bundle_id: string;
  assignee_type: AssigneeType;
  assignee_id: string;
}

/** Input for propose_resolution MCP tool. */
export interface McpProposeResolutionInput {
  bundle_id: string;
  resolution_summary: string;
  files_changed: string[];
  commit_sha?: string;
  pr_url?: string;
}

/** Input for get_session MCP tool. */
export interface McpGetSessionInput {
  session_id: string;
}

/** Input for list_sessions MCP tool. */
export interface McpListSessionsInput {
  project_id: string;
  status?: string;
  limit?: number;
}

/** Input for search_bundles MCP tool. */
export interface McpSearchBundlesInput {
  project_id: string;
  query: string;
  limit?: number;
}

/** Input for get_acceptance_criteria MCP tool. */
export interface McpGetAcceptanceCriteriaInput {
  bundle_id: string;
}

/** Input for validate_bundle MCP tool. */
export interface McpValidateBundleInput {
  bundle_id: string;
  validation_results: Array<{
    step: string;
    passed: boolean;
    evidence?: string;
  }>;
}

// =============================================================================
// Agent Activity query/response types
// =============================================================================

/** Filters for querying agent activity. */
export interface ActivityQueryParams {
  project_id: string;
  source?: AgentActionSource;
  actor_type?: AgentActorType;
  action?: string;
  target_entity_type?: string;
  status?: AgentActionStatus;
  limit?: number; // default 50, max 200
  offset?: number;
}

/** Paginated activity response. */
export interface ActivityQueryResponse {
  actions: AgentAction[];
  total: number;
  limit: number;
  offset: number;
}
