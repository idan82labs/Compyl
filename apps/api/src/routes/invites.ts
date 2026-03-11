/**
 * Reviewer invite routes.
 *
 * Flow:
 *   1. Team member creates invite: POST /projects/:projectId/invites
 *   2. System generates token, stores hash, returns plaintext link
 *   3. Reviewer clicks link: POST /invites/accept { token }
 *   4. System validates token, creates review session
 */

import type { FastifyInstance } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { reviewerInvites, reviewSessions } from "@compyl/db";
import { requireAuth } from "../middleware/auth.js";

/** Hash a token for storage. Never store plaintext tokens. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a secure random token. */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function inviteRoutes(app: FastifyInstance) {
  /**
   * Create a reviewer invite for a project.
   * Requires: member / admin / owner role.
   */
  app.post<{
    Params: { projectId: string };
    Body: { email: string; expires_in_hours?: number };
  }>(
    "/projects/:projectId/invites",
    { preHandler: requireAuth("member", "admin", "owner") },
    async (request, reply) => {
    const { projectId } = request.params;
    const { email, expires_in_hours = 72 } = request.body;

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);

    const [invite] = await app.db
      .insert(reviewerInvites)
      .values({
        projectId,
        email,
        tokenHash,
        expiresAt,
      })
      .returning({ id: reviewerInvites.id });

    return reply.status(201).send({
      invite_id: invite!.id,
      email,
      token, // plaintext — only returned at creation time
      expires_at: expiresAt.toISOString(),
      project_id: projectId,
    });
  },
  );

  /**
   * Accept an invite and bootstrap a review session.
   * The reviewer presents the plaintext token from the invite link.
   */
  app.post<{
    Body: { token: string };
  }>("/invites/accept", async (request, reply) => {
    const { token } = request.body;

    if (!token || typeof token !== "string" || token.trim().length === 0) {
      return reply.status(400).send({ error: "Token is required" });
    }

    const tokenHash = hashToken(token);

    // Look up invite by tokenHash, validate status and expiry
    const invites = await app.db
      .select()
      .from(reviewerInvites)
      .where(
        and(
          eq(reviewerInvites.tokenHash, tokenHash),
          eq(reviewerInvites.status, "pending"),
          gt(reviewerInvites.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const invite = invites[0];
    if (!invite) {
      return reply.status(404).send({ error: "Invalid or expired invite token" });
    }

    // Mark invite as accepted
    await app.db
      .update(reviewerInvites)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(reviewerInvites.id, invite.id));

    // Create review session
    const [session] = await app.db
      .insert(reviewSessions)
      .values({
        projectId: invite.projectId,
        reviewerEmail: invite.email,
      })
      .returning({ id: reviewSessions.id });

    return reply.send({
      session_id: session!.id,
      project_id: invite.projectId,
      status: "active",
    });
  });
}
