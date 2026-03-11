/**
 * @reviewlayer/mcp-server
 *
 * MCP server for ReviewLayer. Exposes ExecutionBundles, sessions, and projects
 * as tools and resources for AI coding agents (Claude Code, Cursor, Codex).
 *
 * Every tool call emits a structured AgentAction audit event via the
 * injected AuditEmitter — no ad-hoc logging.
 *
 * Agent policy: read/propose by default. Close/resolve is human-gated
 * unless explicitly enabled per project.
 */

export { createReviewLayerMcpServer } from "./server.js";
export type { ReviewLayerMcpServerConfig, ApiClient } from "./server.js";
export { createMcpAuditEvent } from "./audit.js";
export type { AuditEmitter } from "./audit.js";
export type { AgentTokenPermission } from "@reviewlayer/contracts";
