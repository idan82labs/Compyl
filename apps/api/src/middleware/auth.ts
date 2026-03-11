/**
 * Authentication and authorization middleware.
 *
 * Trust boundaries:
 * - "reporter": can access sessions and reporter-safe bundle views. No provenance.
 * - "member": team member with full developer access. Can view/edit bundles.
 * - "admin": organization admin. Full access + invite management.
 * - "owner": organization owner. Full access + org settings.
 * - "agent": API token with scoped permissions (read, readwrite, full).
 *
 * Reporter sessions use invite-derived tokens (not user accounts).
 * Team members use Auth.js sessions.
 * Agents use bearer tokens hashed against agent_tokens table.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { agentTokens, organizationMembers, reviewerInvites } from "@reviewlayer/db";

export type AuthRole = "reporter" | "member" | "admin" | "owner" | "agent";

export interface AuthContext {
  role: AuthRole;
  userId?: string;
  email?: string;
  organizationId?: string;
  projectId?: string;
  /** For agent tokens, the permission level. */
  agentPermission?: "read" | "readwrite" | "full";
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Middleware that requires authentication.
 * Extracts auth context from:
 * - Bearer token (agent tokens)
 * - Session cookie (Auth.js — TODO: integrate when Auth.js is set up)
 * - X-Review-Token header (reviewer session tokens)
 */
export function requireAuth(...allowedRoles: AuthRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const reviewToken = request.headers["x-review-token"] as string | undefined;

    // Agent token auth
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const tokenHash = createHash("sha256").update(token).digest("hex");

      const tokens = await request.server.db
        .select()
        .from(agentTokens)
        .where(
          and(
            eq(agentTokens.tokenHash, tokenHash),
            eq(agentTokens.revoked, false),
          ),
        )
        .limit(1);

      const agentToken = tokens[0];
      if (!agentToken) {
        return reply.status(401).send({ error: "Invalid agent token" });
      }

      // Update last used
      await request.server.db
        .update(agentTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(agentTokens.id, agentToken.id));

      request.auth = {
        role: "agent",
        projectId: agentToken.projectId,
        agentPermission: agentToken.permission,
      };
    }
    // Reviewer token auth — validated against accepted invites
    else if (reviewToken) {
      const tokenHash = createHash("sha256").update(reviewToken).digest("hex");

      const invites = await request.server.db
        .select({
          id: reviewerInvites.id,
          projectId: reviewerInvites.projectId,
          status: reviewerInvites.status,
        })
        .from(reviewerInvites)
        .where(
          and(
            eq(reviewerInvites.tokenHash, tokenHash),
            eq(reviewerInvites.status, "accepted"),
          ),
        )
        .limit(1);

      const invite = invites[0];
      if (!invite) {
        return reply.status(401).send({ error: "Invalid or expired review token" });
      }

      request.auth = {
        role: "reporter",
        projectId: invite.projectId,
      };
    }
    // Session auth (Auth.js)
    else {
      // TODO: Integrate Auth.js session validation
      // For now, return 401
      return reply.status(401).send({ error: "Authentication required" });
    }

    // Check role authorization
    if (allowedRoles.length > 0 && request.auth && !allowedRoles.includes(request.auth.role)) {
      return reply.status(403).send({
        error: "Insufficient permissions",
        required_role: allowedRoles,
        current_role: request.auth.role,
      });
    }
  };
}

/**
 * Middleware that blocks agents from mutating reviewer-side state.
 * Agents with "read" permission can only GET.
 * Agents with "readwrite" can modify bundles but not reviewer content.
 */
export function requireWritePermission() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (request.auth?.role === "agent") {
      if (request.auth.agentPermission === "read") {
        return reply.status(403).send({
          error: "Agent token has read-only permission",
        });
      }
    }
  };
}

/**
 * Look up user's role within an organization.
 * Used for team/admin/owner authorization checks.
 */
export async function getUserOrgRole(
  app: FastifyInstance,
  userId: string,
  organizationId: string,
): Promise<AuthRole | null> {
  const members = await app.db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);

  const member = members[0];
  if (!member) return null;

  return member.role as AuthRole;
}
