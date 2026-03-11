/**
 * Audit event emitter for MCP tool calls.
 *
 * Every MCP tool invocation produces an AgentAction event.
 * The emitter is injected at server creation time so callers
 * can route events to structured logging, database, or analytics.
 */

import type { AgentAction, AgentActionStatus } from "@compyl/contracts";
import { randomUUID } from "node:crypto";

export type AuditEmitter = (action: AgentAction) => void;

/**
 * Create an AgentAction event for an MCP tool call.
 * Called before and after each tool handler to capture timing and outcome.
 */
export function createMcpAuditEvent(opts: {
  action: string;
  payload: Record<string, unknown>;
  actorId?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  projectId?: string;
  sessionId?: string;
  status: AgentActionStatus;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
}): AgentAction {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    actor_type: "agent",
    actor_id: opts.actorId,
    source: "mcp",
    action: opts.action,
    payload: opts.payload,
    target_entity_type: opts.targetEntityType,
    target_entity_id: opts.targetEntityId,
    status: opts.status,
    duration_ms: opts.durationMs,
    error_code: opts.errorCode,
    error_message: opts.errorMessage,
    request_id: opts.requestId,
    project_id: opts.projectId,
    session_id: opts.sessionId,
  };
}
