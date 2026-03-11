/**
 * Agent Activity routes.
 *
 * Developer-only surface for querying agent/tool/CLI audit events.
 * Reporter surfaces NEVER see this data.
 *
 * Events are stored in the audit_events table and mapped to/from
 * the AgentAction contract type.
 */

import type { FastifyInstance } from "fastify";
import { eq, desc, and, sql } from "drizzle-orm";
import { auditEvents } from "@reviewlayer/db";
import type {
  AgentAction,
  AgentActionSource,
  AgentActorType,
  AgentActionStatus,
  ActivityQueryResponse,
} from "@reviewlayer/contracts";

/**
 * Map an audit_events row to AgentAction contract shape.
 */
function rowToAgentAction(row: {
  id: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  projectId: string | null;
  createdAt: Date;
}): AgentAction {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;

  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    actor_type: row.actorType as AgentActorType,
    actor_id: row.actorId ?? undefined,
    source: (meta["source"] as AgentActionSource) ?? "api",
    action: row.action,
    payload: (meta["payload"] as Record<string, unknown>) ?? {},
    target_entity_type: row.resourceType,
    target_entity_id: row.resourceId ?? undefined,
    status: (meta["status"] as AgentActionStatus) ?? "success",
    error_code: meta["error_code"] as string | undefined,
    error_message: meta["error_message"] as string | undefined,
    duration_ms: (meta["duration_ms"] as number) ?? 0,
    request_id: meta["request_id"] as string | undefined,
    job_id: meta["job_id"] as string | undefined,
    session_id: meta["session_id"] as string | undefined,
    project_id: row.projectId ?? undefined,
  };
}

export async function activityRoutes(app: FastifyInstance) {
  /**
   * GET /projects/:projectId/activity
   *
   * Query agent activity for a project with optional filters.
   * Developer-only — requires auth (member/admin/owner/agent).
   */
  app.get<{
    Params: { projectId: string };
    Querystring: {
      source?: string;
      actor_type?: string;
      action?: string;
      target_entity_type?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
  }>("/projects/:projectId/activity", async (request) => {
    const { projectId } = request.params;
    const {
      source,
      actor_type,
      action,
      target_entity_type,
      status,
    } = request.query;
    const limit = Math.min(parseInt(request.query.limit ?? "50", 10), 200);
    const offset = parseInt(request.query.offset ?? "0", 10);

    // Build WHERE conditions
    const conditions = [eq(auditEvents.projectId, projectId)];

    if (source) {
      conditions.push(sql`${auditEvents.metadata}->>'source' = ${source}`);
    }
    if (actor_type) {
      conditions.push(eq(auditEvents.actorType, actor_type));
    }
    if (action) {
      conditions.push(eq(auditEvents.action, action));
    }
    if (target_entity_type) {
      conditions.push(eq(auditEvents.resourceType, target_entity_type));
    }
    if (status) {
      conditions.push(sql`${auditEvents.metadata}->>'status' = ${status}`);
    }

    const where = and(...conditions);

    // Count total
    const countResult = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(where);
    const total = countResult[0]?.count ?? 0;

    // Fetch rows
    const rows = await app.db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    const actions: AgentAction[] = rows.map(rowToAgentAction);

    const response: ActivityQueryResponse = {
      actions,
      total,
      limit,
      offset,
    };

    return response;
  });

  /**
   * POST /projects/:projectId/activity
   *
   * Ingest an agent activity event. Used by MCP server and CLI
   * to persist audit events to the database.
   */
  app.post<{
    Params: { projectId: string };
    Body: AgentAction;
  }>("/projects/:projectId/activity", async (request, reply) => {
    const { projectId } = request.params;
    const event = request.body;

    await app.db.insert(auditEvents).values({
      id: event.id,
      projectId,
      actorId: event.actor_id ?? null,
      actorType: event.actor_type,
      action: event.action,
      resourceType: event.target_entity_type ?? "unknown",
      resourceId: event.target_entity_id ?? null,
      metadata: {
        source: event.source,
        payload: event.payload,
        status: event.status,
        duration_ms: event.duration_ms,
        error_code: event.error_code,
        error_message: event.error_message,
        request_id: event.request_id,
        job_id: event.job_id,
        session_id: event.session_id,
      },
    });

    return reply.status(201).send({ ok: true });
  });
}
