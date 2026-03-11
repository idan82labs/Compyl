/**
 * Execution bundle routes (developer-facing).
 *
 * These endpoints return full technical context including provenance.
 * exact_source and resolved_component_stack are ALWAYS separate fields.
 *
 * Trust boundary: requires team member / admin / owner / agent auth (not reporter).
 *
 * Curation gate:
 * - Status transitions are validated (not all transitions are allowed)
 * - Agent resolve is blocked by default unless project policy enables it
 * - Agents can propose resolutions but cannot close/resolve items
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { executionBundles, projects, developerBundleColumns } from "@reviewlayer/db";
import { requireAuth, requireWritePermission } from "../middleware/auth.js";
import type { BundleStatus } from "@reviewlayer/contracts";

// =============================================================================
// Input validation
// =============================================================================

const VALID_BUNDLE_STATUSES: BundleStatus[] = [
  "pending_review",
  "approved",
  "in_progress",
  "resolved",
  "rejected",
];

function isValidBundleStatus(status: string): status is BundleStatus {
  return VALID_BUNDLE_STATUSES.includes(status as BundleStatus);
}

// =============================================================================
// Status transition rules
// =============================================================================

/**
 * Valid status transitions. Key = current status, value = allowed next statuses.
 *
 * Flow:
 *   pending_review → approved | rejected
 *   approved → in_progress | pending_review
 *   in_progress → resolved | approved
 *   resolved → in_progress
 *   rejected → pending_review
 */
const VALID_TRANSITIONS: Record<BundleStatus, BundleStatus[]> = {
  pending_review: ["approved", "rejected"],
  approved: ["in_progress", "pending_review"],
  in_progress: ["resolved", "approved"],
  resolved: ["in_progress"],
  rejected: ["pending_review"],
};

/** Statuses that agents cannot transition TO without explicit project policy. */
const AGENT_GATED_STATUSES: BundleStatus[] = ["resolved", "rejected"];

function isValidTransition(from: BundleStatus, to: BundleStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function bundleRoutes(app: FastifyInstance) {
  /**
   * Get a single bundle with full developer context.
   * Includes exact_source, resolved_component_stack, severity,
   * acceptance_criteria, etc.
   */
  app.get<{
    Params: { bundleId: string };
  }>(
    "/bundles/:bundleId",
    { preHandler: requireAuth("member", "admin", "owner", "agent") },
    async (request, reply) => {
      const { bundleId } = request.params;

      const bundles = await app.db
        .select(developerBundleColumns)
        .from(executionBundles)
        .where(eq(executionBundles.id, bundleId))
        .limit(1);

      const bundle = bundles[0];
      if (!bundle) {
        return reply.status(404).send({ error: "Bundle not found" });
      }

      return bundle;
    },
  );

  /**
   * List bundles for a project with full developer context.
   */
  app.get<{
    Params: { projectId: string };
    Querystring: { limit?: string; offset?: string };
  }>(
    "/projects/:projectId/bundles",
    { preHandler: requireAuth("member", "admin", "owner", "agent") },
    async (request, _reply) => {
      const { projectId } = request.params;
      const limit = Math.min(parseInt(request.query.limit ?? "50", 10), 100);
      const offset = parseInt(request.query.offset ?? "0", 10);

      const bundles = await app.db
        .select(developerBundleColumns)
        .from(executionBundles)
        .where(eq(executionBundles.projectId, projectId))
        .limit(limit)
        .offset(offset);

      return { bundles, count: bundles.length, limit, offset };
    },
  );

  /**
   * Update bundle lifecycle (status, assignee).
   * Used by developers in the Triage Workspace.
   * Agents need at least "readwrite" permission.
   *
   * Curation gate rules:
   * - Status transitions are validated against VALID_TRANSITIONS
   * - Agents cannot transition to "resolved" or "rejected" unless
   *   the project has agent_resolution_enabled (default: false)
   * - Invalid transitions return 422
   */
  app.patch<{
    Params: { bundleId: string };
    Body: {
      status?: string;
      assignee_type?: string;
      assignee_id?: string;
    };
  }>(
    "/bundles/:bundleId",
    {
      preHandler: [
        requireAuth("member", "admin", "owner", "agent"),
        requireWritePermission(),
      ],
    },
    async (request, reply) => {
      const { bundleId } = request.params;
      const { status: newStatus, assignee_type, assignee_id } = request.body;

      // Fetch current bundle state
      const existing = await app.db
        .select({
          id: executionBundles.id,
          status: executionBundles.status,
          projectId: executionBundles.projectId,
        })
        .from(executionBundles)
        .where(eq(executionBundles.id, bundleId))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: "Bundle not found" });
      }

      const bundle = existing[0]!;

      // Input validation — reject unknown status values before transition check
      if (newStatus && !isValidBundleStatus(newStatus)) {
        return reply.status(400).send({
          error: "Invalid status value",
          provided: newStatus,
          valid_statuses: VALID_BUNDLE_STATUSES,
        });
      }

      // Status transition validation
      if (newStatus) {
        const currentStatus = bundle.status as BundleStatus;
        const targetStatus = newStatus as BundleStatus;

        if (!isValidTransition(currentStatus, targetStatus)) {
          return reply.status(422).send({
            error: "Invalid status transition",
            current_status: currentStatus,
            requested_status: targetStatus,
            allowed_transitions: VALID_TRANSITIONS[currentStatus] ?? [],
          });
        }

        // Agent resolution guard — agents cannot resolve/reject without project policy
        if (request.auth?.role === "agent" && AGENT_GATED_STATUSES.includes(targetStatus)) {
          // Check project policy
          const projectRows = await app.db
            .select({ agentResolutionEnabled: projects.agentResolutionEnabled })
            .from(projects)
            .where(eq(projects.id, bundle.projectId))
            .limit(1);

          const project = projectRows[0];
          if (!project?.agentResolutionEnabled) {
            return reply.status(403).send({
              error: "Agent resolution not enabled",
              message: `Agents cannot transition bundles to "${targetStatus}" unless the project has agent resolution enabled. A human must perform this action.`,
            });
          }
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (newStatus) updates["status"] = newStatus;
      if (assignee_type) updates["assigneeType"] = assignee_type;
      if (assignee_id !== undefined) updates["assigneeId"] = assignee_id;

      await app.db
        .update(executionBundles)
        .set(updates)
        .where(eq(executionBundles.id, bundleId));

      return { bundle_id: bundleId, updated: true };
    },
  );
}
