/**
 * Design candidates routes — developer-only.
 *
 * Exposes Figma candidate ranking results and ranking traces
 * for the developer surface. Reporter surface NEVER sees these.
 *
 * Routes:
 * - GET /bundles/:bundleId/design-candidates — retrieve ranked candidates
 * - GET /projects/:projectId/ranking-traces — retrieve ranking trace events
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { executionBundles, designCandidates as designCandidatesTable } from "@reviewlayer/db";
import type { DesignCandidate, FigmaRankingTraceEvent } from "@reviewlayer/contracts";

// In-memory trace store (replaced by DB/analytics in production)
const rankingTraces: FigmaRankingTraceEvent[] = [];

/** Record a ranking trace event. Exported for use by ranking service integration. */
export function recordRankingTrace(trace: FigmaRankingTraceEvent): void {
  rankingTraces.push(trace);
  // Keep bounded (last 1000 traces)
  if (rankingTraces.length > 1000) {
    rankingTraces.splice(0, rankingTraces.length - 1000);
  }
}

/** Get all recorded ranking traces. Exported for testing. */
export function getRankingTraces(): FigmaRankingTraceEvent[] {
  return rankingTraces;
}

/** Clear all recorded ranking traces. Exported for testing. */
export function clearRankingTraces(): void {
  rankingTraces.length = 0;
}

export async function designCandidateRoutes(app: FastifyInstance) {
  /**
   * GET /bundles/:bundleId/design-candidates
   *
   * Developer-only endpoint. Returns the ranked Figma design candidates
   * for a bundle, including confidence scores and ranking signals.
   */
  app.get<{
    Params: { bundleId: string };
  }>(
    "/bundles/:bundleId/design-candidates",
    async (request, reply) => {
      const { bundleId } = request.params;

      // Fetch bundle's design_candidates from the jsonb column
      const results = await app.db
        .select({
          designCandidates: executionBundles.designCandidates,
          confidence: executionBundles.confidence,
        })
        .from(executionBundles)
        .where(eq(executionBundles.id, bundleId))
        .limit(1);

      const bundle = results[0];
      if (!bundle) {
        return reply.status(404).send({ error: "Bundle not found" });
      }

      // Also fetch from normalized design_candidates table
      const normalizedCandidates = await app.db
        .select()
        .from(designCandidatesTable)
        .where(eq(designCandidatesTable.bundleId, bundleId));

      const candidates = (bundle.designCandidates ?? []) as DesignCandidate[];

      return {
        bundle_id: bundleId,
        candidates,
        normalized_candidates: normalizedCandidates.map((c) => ({
          id: c.id,
          figma_component_id: c.figmaComponentId,
          component_name: c.componentName,
          confidence: c.confidence / 100, // DB stores 0-100, contract uses 0-1
          ranking_evidence: c.rankingEvidence,
        })),
        confidence: bundle.confidence,
      };
    },
  );

  /**
   * GET /projects/:projectId/ranking-traces
   *
   * Developer-only endpoint. Returns Figma candidate ranking trace events
   * for observability. Supports filtering by bundle_id.
   */
  app.get<{
    Params: { projectId: string };
    Querystring: { bundle_id?: string; limit?: string };
  }>(
    "/projects/:projectId/ranking-traces",
    async (request, _reply) => {
      const { bundle_id, limit: limitStr } = request.query;
      const limit = limitStr ? parseInt(limitStr, 10) : 50;

      let traces = rankingTraces;
      if (bundle_id) {
        traces = traces.filter((t) => t.bundle_id === bundle_id);
      }

      // Most recent first
      const sorted = [...traces].reverse().slice(0, limit);

      return {
        traces: sorted,
        total: traces.length,
      };
    },
  );
}
