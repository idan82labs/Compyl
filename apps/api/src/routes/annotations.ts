/**
 * Annotation routes.
 *
 * Annotations are created by reporters during a review session.
 * They capture visual feedback: element selection, freeform drawing,
 * screenshot regions, full-page notes, and reference images.
 *
 * Trust boundary: reporters can create/list annotations within their session.
 * Developers can view annotations via the bundle routes.
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { annotations, reviewSessions } from "@reviewlayer/db";

export async function annotationRoutes(app: FastifyInstance) {
  /**
   * Create an annotation within a session.
   * Reporter-facing — captures raw feedback without provenance.
   */
  app.post<{
    Params: { sessionId: string };
    Body: {
      type: "element_select" | "freeform_draw" | "screenshot_region" | "full_page_note" | "reference_image";
      page_url: string;
      viewport?: { width: number; height: number; scroll_x: number; scroll_y: number };
      dom_selector?: string;
      element_bbox?: { x: number; y: number; width: number; height: number };
      computed_styles?: Record<string, string>;
      raw_text?: string;
      drawing_svg_url?: string;
      screenshot_url?: string;
      reference_images?: string[];
    };
  }>("/sessions/:sessionId/annotations", async (request, reply) => {
    const { sessionId } = request.params;

    // Verify session exists and is active
    const sessions = await app.db
      .select({ id: reviewSessions.id, status: reviewSessions.status })
      .from(reviewSessions)
      .where(eq(reviewSessions.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    if (session.status !== "active") {
      return reply.status(409).send({ error: "Session is not active" });
    }

    const body = request.body;

    // Input validation
    const validTypes = ["element_select", "freeform_draw", "screenshot_region", "full_page_note", "reference_image"];
    if (!body.type || !validTypes.includes(body.type)) {
      return reply.status(400).send({
        error: "Invalid annotation type",
        valid_types: validTypes,
      });
    }
    if (!body.page_url || typeof body.page_url !== "string") {
      return reply.status(400).send({ error: "page_url is required" });
    }

    const [annotation] = await app.db
      .insert(annotations)
      .values({
        sessionId,
        type: body.type,
        pageUrl: body.page_url,
        viewport: body.viewport,
        domSelector: body.dom_selector,
        elementBbox: body.element_bbox,
        computedStyles: body.computed_styles,
        rawText: body.raw_text,
        drawingSvgUrl: body.drawing_svg_url,
        screenshotUrl: body.screenshot_url,
        referenceImages: body.reference_images ?? [],
      })
      .returning({
        id: annotations.id,
        type: annotations.type,
        createdAt: annotations.createdAt,
      });

    return reply.status(201).send({
      annotation_id: annotation!.id,
      type: annotation!.type,
      session_id: sessionId,
      created_at: annotation!.createdAt.toISOString(),
    });
  });

  /**
   * List annotations for a session.
   * Reporter-facing — returns annotation metadata without provenance.
   */
  app.get<{
    Params: { sessionId: string };
  }>("/sessions/:sessionId/annotations", async (request, reply) => {
    const { sessionId } = request.params;

    // Verify session exists
    const sessions = await app.db
      .select({ id: reviewSessions.id })
      .from(reviewSessions)
      .where(eq(reviewSessions.id, sessionId))
      .limit(1);

    if (sessions.length === 0) {
      return reply.status(404).send({ error: "Session not found" });
    }

    const results = await app.db
      .select({
        id: annotations.id,
        type: annotations.type,
        pageUrl: annotations.pageUrl,
        rawText: annotations.rawText,
        screenshotUrl: annotations.screenshotUrl,
        referenceImages: annotations.referenceImages,
        createdAt: annotations.createdAt,
      })
      .from(annotations)
      .where(eq(annotations.sessionId, sessionId));

    return { annotations: results, count: results.length };
  });

  /**
   * Delete an annotation (reporter can remove during active session).
   */
  app.delete<{
    Params: { sessionId: string; annotationId: string };
  }>("/sessions/:sessionId/annotations/:annotationId", async (request, reply) => {
    const { sessionId, annotationId } = request.params;

    // Verify session is active
    const sessions = await app.db
      .select({ id: reviewSessions.id, status: reviewSessions.status })
      .from(reviewSessions)
      .where(eq(reviewSessions.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session || session.status !== "active") {
      return reply.status(409).send({ error: "Cannot modify a non-active session" });
    }

    // Verify annotation belongs to this session
    const existing = await app.db
      .select({ id: annotations.id })
      .from(annotations)
      .where(eq(annotations.id, annotationId))
      .limit(1);

    if (existing.length === 0) {
      return reply.status(404).send({ error: "Annotation not found" });
    }

    await app.db
      .delete(annotations)
      .where(eq(annotations.id, annotationId));

    return { deleted: true, annotation_id: annotationId };
  });
}
