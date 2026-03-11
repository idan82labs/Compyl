/**
 * Compyl MCP server implementation.
 *
 * Uses @modelcontextprotocol/sdk McpServer with registerTool API.
 * Tools are organized by entity type: bundles, sessions, projects.
 *
 * Every tool call emits a structured AgentAction audit event.
 * Read-only tools use annotations { readOnlyHint: true }.
 * Mutating tools use annotations { destructiveHint: false }.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AgentDTO, AgentTokenPermission } from "@reviewlayer/contracts";
import { createMcpAuditEvent, type AuditEmitter } from "./audit.js";

// =============================================================================
// API client interface — injected at creation time
// =============================================================================

/**
 * Abstract API client that the MCP server calls to fetch/mutate data.
 * Implemented by the host application (e.g. Fastify API server or standalone HTTP client).
 */
export interface ApiClient {
  listBundles(params: {
    project_id: string;
    status?: string;
    severity?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ bundles: AgentDTO[]; total: number }>;

  getBundle(bundleId: string): Promise<AgentDTO | null>;

  updateBundleStatus(
    bundleId: string,
    status: string,
    reason?: string,
  ): Promise<{ success: boolean; error?: string }>;

  assignBundle(
    bundleId: string,
    assigneeType: string,
    assigneeId: string,
  ): Promise<{ success: boolean; error?: string }>;

  proposeResolution(
    bundleId: string,
    params: {
      resolution_summary: string;
      files_changed: string[];
      commit_sha?: string;
      pr_url?: string;
    },
  ): Promise<{ success: boolean; proposal_id?: string; error?: string }>;

  getSession(sessionId: string): Promise<{
    session_id: string;
    project_id: string;
    status: string;
    bundle_count: number;
  } | null>;

  listSessions(params: {
    project_id: string;
    status?: string;
    limit?: number;
  }): Promise<Array<{
    session_id: string;
    status: string;
    bundle_count: number;
    submitted_at: string | null;
  }>>;

  searchBundles(params: {
    project_id: string;
    query: string;
    limit?: number;
  }): Promise<{ bundles: AgentDTO[]; total: number }>;

  getAcceptanceCriteria(bundleId: string): Promise<{
    bundle_id: string;
    acceptance_criteria: string[];
    validation_steps: string[];
  } | null>;

  submitValidationResults(
    bundleId: string,
    results: Array<{ step: string; passed: boolean; evidence?: string }>,
  ): Promise<{ success: boolean; error?: string }>;
}

// =============================================================================
// Server config
// =============================================================================

export interface ReviewLayerMcpServerConfig {
  apiClient: ApiClient;
  auditEmitter: AuditEmitter;
  /** Actor ID for audit events (e.g. agent token ID). */
  actorId?: string;
  /** Token permission level. When set, mutating tools are blocked for "read" tokens. */
  permission?: AgentTokenPermission;
}

// =============================================================================
// Scope enforcement
// =============================================================================

/** Tools that mutate state require at least "readwrite" permission. */
const MUTATING_TOOLS = new Set([
  "update_bundle_status",
  "assign_bundle",
  "propose_resolution",
  "validate_bundle",
]);

/** Check if a tool is allowed for the given permission level. */
function isToolAllowed(toolName: string, permission: AgentTokenPermission | undefined): boolean {
  // No permission set → no enforcement (e.g. embedded mode without auth)
  if (!permission) return true;
  // "full" and "readwrite" can do everything
  if (permission === "full" || permission === "readwrite") return true;
  // "read" can only use non-mutating tools
  return !MUTATING_TOOLS.has(toolName);
}

// =============================================================================
// Audit helper — emits event, returns result or rethrows
// =============================================================================

/** Error thrown when a tool call is denied due to insufficient scope. */
class ScopeDeniedError extends Error {
  constructor(toolName: string, permission: string) {
    super(`Tool "${toolName}" requires write permission, but token has "${permission}" scope`);
    this.name = "ScopeDeniedError";
  }
}

async function audited<T>(
  emitter: AuditEmitter,
  toolName: string,
  payload: Record<string, unknown>,
  target: { type?: string; id?: string; projectId?: string; sessionId?: string },
  actorId: string | undefined,
  permission: AgentTokenPermission | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();

  // Scope enforcement — check before executing
  if (!isToolAllowed(toolName, permission)) {
    emitter(createMcpAuditEvent({
      action: toolName,
      payload,
      actorId,
      targetEntityType: target.type,
      targetEntityId: target.id,
      projectId: target.projectId,
      sessionId: target.sessionId,
      status: "denied",
      durationMs: Date.now() - start,
      errorCode: "SCOPE_DENIED",
      errorMessage: `Token with "${permission}" permission cannot call mutating tool "${toolName}"`,
    }));
    throw new ScopeDeniedError(toolName, permission ?? "unknown");
  }

  try {
    const result = await fn();
    emitter(createMcpAuditEvent({
      action: toolName,
      payload,
      actorId,
      targetEntityType: target.type,
      targetEntityId: target.id,
      projectId: target.projectId,
      sessionId: target.sessionId,
      status: "success",
      durationMs: Date.now() - start,
    }));
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    emitter(createMcpAuditEvent({
      action: toolName,
      payload,
      actorId,
      targetEntityType: target.type,
      targetEntityId: target.id,
      projectId: target.projectId,
      sessionId: target.sessionId,
      status: "error",
      durationMs: Date.now() - start,
      errorCode: "TOOL_ERROR",
      errorMessage: error.message,
    }));
    throw err;
  }
}

// =============================================================================
// Server factory
// =============================================================================

export function createReviewLayerMcpServer(config: ReviewLayerMcpServerConfig): McpServer {
  const { apiClient, auditEmitter, actorId, permission } = config;

  const mcp = new McpServer({
    name: "reviewlayer",
    version: "0.1.0",
  }, {
    capabilities: {
      resources: {},
      tools: {},
    },
  });

  // ---------------------------------------------------------------------------
  // Tool 1: list_bundles
  // ---------------------------------------------------------------------------
  const listBundlesSchema = {
    project_id: z.string().describe("Project ID to list bundles for"),
    status: z.enum(["pending_review", "approved", "in_progress", "resolved", "rejected"]).optional().describe("Filter by bundle status"),
    severity: z.enum(["critical", "major", "minor", "suggestion"]).optional().describe("Filter by severity"),
    category: z.enum(["visual_bug", "layout_issue", "copy_change", "feature_request", "behavior_bug", "accessibility", "performance"]).optional().describe("Filter by feedback category"),
    limit: z.number().int().min(1).max(200).optional().describe("Max results (default 50)"),
    offset: z.number().int().min(0).optional().describe("Pagination offset"),
  };
  type ListBundlesArgs = z.infer<z.ZodObject<typeof listBundlesSchema>>;

  mcp.registerTool("list_bundles", {
    title: "List Bundles",
    description: "List ExecutionBundles for a project with optional filters (status, severity, category). Returns AgentDTO payloads.",
    inputSchema: listBundlesSchema,
    annotations: { readOnlyHint: true },
  }, async (raw) => {
    const args = raw as ListBundlesArgs;
    const result = await audited(auditEmitter, "list_bundles", args as unknown as Record<string, unknown>,
      { type: "project", id: args.project_id, projectId: args.project_id }, actorId, permission,
      () => apiClient.listBundles({
        project_id: args.project_id,
        status: args.status,
        severity: args.severity,
        category: args.category,
        limit: args.limit,
        offset: args.offset,
      }),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  // ---------------------------------------------------------------------------
  // Tool 2: get_bundle
  // ---------------------------------------------------------------------------
  const getBundleSchema = { bundle_id: z.string().describe("Bundle ID to retrieve") };
  type GetBundleArgs = z.infer<z.ZodObject<typeof getBundleSchema>>;

  mcp.registerTool("get_bundle", {
    title: "Get Bundle",
    description: "Get a single ExecutionBundle by ID. Returns full AgentDTO with provenance (exact_source and resolved_component_stack as separate fields).",
    inputSchema: getBundleSchema,
    annotations: { readOnlyHint: true },
  }, async (raw) => {
    const args = raw as GetBundleArgs;
    const bundle = await audited(auditEmitter, "get_bundle", { bundle_id: args.bundle_id },
      { type: "bundle", id: args.bundle_id }, actorId, permission,
      () => apiClient.getBundle(args.bundle_id),
    );
    if (!bundle) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Bundle not found" }) }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(bundle, null, 2) }] };
  });

  // ---------------------------------------------------------------------------
  // Tool 3: update_bundle_status
  // ---------------------------------------------------------------------------
  const updateStatusSchema = {
    bundle_id: z.string().describe("Bundle ID to update"),
    status: z.enum(["pending_review", "approved", "in_progress", "resolved", "rejected"]).describe("New status"),
    reason: z.string().optional().describe("Reason for the status change"),
  };
  type UpdateStatusArgs = z.infer<z.ZodObject<typeof updateStatusSchema>>;

  mcp.registerTool("update_bundle_status", {
    title: "Update Bundle Status",
    description: "Change the status of a bundle (e.g. pending_review → in_progress). Note: resolve/reject transitions may require human approval depending on project policy.",
    inputSchema: updateStatusSchema,
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (raw) => {
    const args = raw as UpdateStatusArgs;
    const result = await audited(auditEmitter, "update_bundle_status", { bundle_id: args.bundle_id, status: args.status },
      { type: "bundle", id: args.bundle_id }, actorId, permission,
      () => apiClient.updateBundleStatus(args.bundle_id, args.status, args.reason),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }], isError: !result.success };
  });

  // ---------------------------------------------------------------------------
  // Tool 4: assign_bundle
  // ---------------------------------------------------------------------------
  const assignBundleSchema = {
    bundle_id: z.string().describe("Bundle ID to assign"),
    assignee_type: z.enum(["human", "agent", "unassigned"]).describe("Type of assignee"),
    assignee_id: z.string().describe("ID of the assignee (user or agent token)"),
  };
  type AssignBundleArgs = z.infer<z.ZodObject<typeof assignBundleSchema>>;

  mcp.registerTool("assign_bundle", {
    title: "Assign Bundle",
    description: "Assign a bundle to a human developer or AI agent.",
    inputSchema: assignBundleSchema,
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (raw) => {
    const args = raw as AssignBundleArgs;
    const result = await audited(auditEmitter, "assign_bundle", { bundle_id: args.bundle_id, assignee_type: args.assignee_type },
      { type: "bundle", id: args.bundle_id }, actorId, permission,
      () => apiClient.assignBundle(args.bundle_id, args.assignee_type, args.assignee_id),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }], isError: !result.success };
  });

  // ---------------------------------------------------------------------------
  // Tool 5: propose_resolution
  // ---------------------------------------------------------------------------
  const proposeResolutionSchema = {
    bundle_id: z.string().describe("Bundle ID to propose resolution for"),
    resolution_summary: z.string().describe("Summary of the proposed resolution"),
    files_changed: z.array(z.string()).describe("File paths that were changed"),
    commit_sha: z.string().optional().describe("Git commit SHA of the fix"),
    pr_url: z.string().optional().describe("Pull request URL"),
  };
  type ProposeResolutionArgs = z.infer<z.ZodObject<typeof proposeResolutionSchema>>;

  mcp.registerTool("propose_resolution", {
    title: "Propose Resolution",
    description: "Agent proposes a resolution for a bundle. Does NOT close the item — human review is required for close/resolve transitions unless project policy allows agent-resolve.",
    inputSchema: proposeResolutionSchema,
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (raw) => {
    const args = raw as ProposeResolutionArgs;
    const result = await audited(auditEmitter, "propose_resolution", { bundle_id: args.bundle_id },
      { type: "bundle", id: args.bundle_id }, actorId, permission,
      () => apiClient.proposeResolution(args.bundle_id, {
        resolution_summary: args.resolution_summary,
        files_changed: args.files_changed,
        commit_sha: args.commit_sha,
        pr_url: args.pr_url,
      }),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }], isError: !result.success };
  });

  // ---------------------------------------------------------------------------
  // Tool 6: get_session
  // ---------------------------------------------------------------------------
  const getSessionSchema = { session_id: z.string().describe("Session ID to retrieve") };
  type GetSessionArgs = z.infer<z.ZodObject<typeof getSessionSchema>>;

  mcp.registerTool("get_session", {
    title: "Get Session",
    description: "Get review session details by ID.",
    inputSchema: getSessionSchema,
    annotations: { readOnlyHint: true },
  }, async (raw) => {
    const args = raw as GetSessionArgs;
    const session = await audited(auditEmitter, "get_session", { session_id: args.session_id },
      { type: "session", id: args.session_id, sessionId: args.session_id }, actorId, permission,
      () => apiClient.getSession(args.session_id),
    );
    if (!session) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Session not found" }) }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(session, null, 2) }] };
  });

  // ---------------------------------------------------------------------------
  // Tool 7: list_sessions
  // ---------------------------------------------------------------------------
  const listSessionsSchema = {
    project_id: z.string().describe("Project ID"),
    status: z.string().optional().describe("Filter by session status (active, submitted, expired)"),
    limit: z.number().int().min(1).max(100).optional().describe("Max results"),
  };
  type ListSessionsArgs = z.infer<z.ZodObject<typeof listSessionsSchema>>;

  mcp.registerTool("list_sessions", {
    title: "List Sessions",
    description: "List review sessions for a project.",
    inputSchema: listSessionsSchema,
    annotations: { readOnlyHint: true },
  }, async (raw) => {
    const args = raw as ListSessionsArgs;
    const result = await audited(auditEmitter, "list_sessions", { project_id: args.project_id },
      { type: "project", id: args.project_id, projectId: args.project_id }, actorId, permission,
      () => apiClient.listSessions({ project_id: args.project_id, status: args.status, limit: args.limit }),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  // ---------------------------------------------------------------------------
  // Tool 8: search_bundles
  // ---------------------------------------------------------------------------
  const searchBundlesSchema = {
    project_id: z.string().describe("Project ID to search within"),
    query: z.string().describe("Search query"),
    limit: z.number().int().min(1).max(100).optional().describe("Max results"),
  };
  type SearchBundlesArgs = z.infer<z.ZodObject<typeof searchBundlesSchema>>;

  mcp.registerTool("search_bundles", {
    title: "Search Bundles",
    description: "Full-text search across bundles in a project. Searches title, summary, normalized_task, and component names.",
    inputSchema: searchBundlesSchema,
    annotations: { readOnlyHint: true },
  }, async (raw) => {
    const args = raw as SearchBundlesArgs;
    const result = await audited(auditEmitter, "search_bundles", { project_id: args.project_id, query: args.query },
      { type: "project", id: args.project_id, projectId: args.project_id }, actorId, permission,
      () => apiClient.searchBundles({ project_id: args.project_id, query: args.query, limit: args.limit }),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  // ---------------------------------------------------------------------------
  // Tool 9: get_acceptance_criteria
  // ---------------------------------------------------------------------------
  const getAcceptanceCriteriaSchema = { bundle_id: z.string().describe("Bundle ID") };
  type GetAcceptanceCriteriaArgs = z.infer<z.ZodObject<typeof getAcceptanceCriteriaSchema>>;

  mcp.registerTool("get_acceptance_criteria", {
    title: "Get Acceptance Criteria",
    description: "Get the acceptance criteria and validation steps for a bundle.",
    inputSchema: getAcceptanceCriteriaSchema,
    annotations: { readOnlyHint: true },
  }, async (raw) => {
    const args = raw as GetAcceptanceCriteriaArgs;
    const result = await audited(auditEmitter, "get_acceptance_criteria", { bundle_id: args.bundle_id },
      { type: "bundle", id: args.bundle_id }, actorId, permission,
      () => apiClient.getAcceptanceCriteria(args.bundle_id),
    );
    if (!result) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Bundle not found" }) }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  // ---------------------------------------------------------------------------
  // Tool 10: validate_bundle
  // ---------------------------------------------------------------------------
  const validateBundleSchema = {
    bundle_id: z.string().describe("Bundle ID to validate"),
    validation_results: z.array(z.object({
      step: z.string().describe("Validation step description"),
      passed: z.boolean().describe("Whether this step passed"),
      evidence: z.string().optional().describe("Evidence or explanation"),
    })).describe("Validation results for each acceptance criterion"),
  };
  type ValidateBundleArgs = z.infer<z.ZodObject<typeof validateBundleSchema>>;

  mcp.registerTool("validate_bundle", {
    title: "Validate Bundle",
    description: "Submit validation results for a bundle's acceptance criteria. Each validation step is marked as passed/failed with optional evidence.",
    inputSchema: validateBundleSchema,
    annotations: { readOnlyHint: false, destructiveHint: false },
  }, async (raw) => {
    const args = raw as ValidateBundleArgs;
    const result = await audited(auditEmitter, "validate_bundle", { bundle_id: args.bundle_id },
      { type: "bundle", id: args.bundle_id }, actorId, permission,
      () => apiClient.submitValidationResults(args.bundle_id, args.validation_results),
    );
    return { content: [{ type: "text" as const, text: JSON.stringify(result) }], isError: !result.success };
  });

  // ---------------------------------------------------------------------------
  // Resource templates
  // ---------------------------------------------------------------------------

  mcp.registerResource(
    "bundle",
    new ResourceTemplate("reviewlayer://bundles/{bundleId}", { list: undefined }),
    { description: "A single ExecutionBundle with full provenance context" },
    async (uri, variables) => {
      const bundleId = variables["bundleId"] as string;
      const bundle = await apiClient.getBundle(bundleId);
      if (!bundle) {
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ error: "Not found" }) }] };
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(bundle, null, 2) }] };
    },
  );

  mcp.registerResource(
    "project_bundles",
    new ResourceTemplate("reviewlayer://projects/{projectId}/bundles", { list: undefined }),
    { description: "All bundles for a project" },
    async (uri, variables) => {
      const projectId = variables["projectId"] as string;
      const result = await apiClient.listBundles({ project_id: projectId, limit: 200 });
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(result, null, 2) }] };
    },
  );

  mcp.registerResource(
    "session",
    new ResourceTemplate("reviewlayer://sessions/{sessionId}", { list: undefined }),
    { description: "Review session details" },
    async (uri, variables) => {
      const sessionId = variables["sessionId"] as string;
      const session = await apiClient.getSession(sessionId);
      if (!session) {
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ error: "Not found" }) }] };
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(session, null, 2) }] };
    },
  );

  mcp.registerResource(
    "project_sessions",
    new ResourceTemplate("reviewlayer://projects/{projectId}/sessions", { list: undefined }),
    { description: "All review sessions for a project" },
    async (uri, variables) => {
      const projectId = variables["projectId"] as string;
      const sessions = await apiClient.listSessions({ project_id: projectId });
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(sessions, null, 2) }] };
    },
  );

  return mcp;
}
