/**
 * CLI audit event emitter.
 *
 * Every CLI command produces a structured AgentAction event with source="cli".
 * The emitter writes to stderr as structured JSON in standalone mode.
 */

import type { AgentAction, AgentActionStatus } from "@compyl/contracts";
import { randomUUID } from "node:crypto";

export type CliAuditEmitter = (action: AgentAction) => void;

export function createCliAuditEvent(opts: {
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
}): AgentAction {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    actor_type: "agent",
    actor_id: opts.actorId,
    source: "cli",
    action: opts.action,
    payload: opts.payload,
    target_entity_type: opts.targetEntityType,
    target_entity_id: opts.targetEntityId,
    status: opts.status,
    duration_ms: opts.durationMs,
    error_code: opts.errorCode,
    error_message: opts.errorMessage,
    project_id: opts.projectId,
    session_id: opts.sessionId,
  };
}
