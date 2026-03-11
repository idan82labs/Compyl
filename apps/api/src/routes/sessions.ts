/**
 * Review session routes.
 *
 * Sessions are created when a reviewer accepts an invite.
 * Session endpoints enforce the reporter trust boundary —
 * reporters NEVER see provenance fields.
 *
 * Session submit triggers bundle compilation:
 * 1. Fetch all annotations for the session
 * 2. For each annotation, submit summarize_annotation worker job
 * 3. Submit compile_bundle to produce final ExecutionBundles
 * This pipeline is async — submit returns immediately, bundles appear later.
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  reviewSessions,
  annotations,
  executionBundles,
  reporterBundleColumns,
} from "@compyl/db";
import { WorkerClient } from "../worker-client.js";
import { WorkerErrorRateTracker } from "../worker-error-rate.js";
import { randomUUID } from "node:crypto";

/** Singleton error rate tracker per Fastify instance. Shared across all session compilations. */
let errorRateTracker: WorkerErrorRateTracker | undefined;

function getErrorRateTracker(app: FastifyInstance): WorkerErrorRateTracker {
  if (!errorRateTracker) {
    errorRateTracker = new WorkerErrorRateTracker({
      threshold: 0.05, // 5% error rate triggers alert
      windowMs: 300_000, // 5 minute sliding window
      minSampleSize: 10, // need 10 jobs before alerting
      onAlert: (alert) => {
        const level = alert.recovered ? "info" : "error";
        app.log[level]({
          diagnostic: "worker_error_rate",
          ...alert,
        }, alert.recovered
          ? `Worker error rate recovered: ${(alert.error_rate * 100).toFixed(1)}% (below ${(alert.threshold * 100).toFixed(0)}% threshold)`
          : `Worker error rate ALERT: ${(alert.error_rate * 100).toFixed(1)}% exceeds ${(alert.threshold * 100).toFixed(0)}% threshold (${alert.failed_jobs}/${alert.total_jobs} failures in ${alert.window_ms / 1000}s window)`);
      },
    });
  }
  return errorRateTracker;
}

export async function sessionRoutes(app: FastifyInstance) {
  /**
   * Get session details (reporter-safe).
   * Returns only reporter-visible fields for bundles.
   */
  app.get<{
    Params: { sessionId: string };
  }>("/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params;

    const sessions = await app.db
      .select()
      .from(reviewSessions)
      .where(eq(reviewSessions.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    // Fetch bundles with reporterBundleColumns ONLY — enforces trust boundary
    const bundles = await app.db
      .select(reporterBundleColumns)
      .from(executionBundles)
      .where(eq(executionBundles.sessionId, sessionId));

    return {
      session_id: session.id,
      project_id: session.projectId,
      status: session.status,
      started_at: session.startedAt.toISOString(),
      submitted_at: session.submittedAt?.toISOString() ?? null,
      bundles,
    };
  });

  /**
   * Submit a session (reviewer finalizes their review).
   */
  app.post<{
    Params: { sessionId: string };
  }>("/sessions/:sessionId/submit", async (request, reply) => {
    const { sessionId } = request.params;

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

    await app.db
      .update(reviewSessions)
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(reviewSessions.id, sessionId));

    // Trigger async bundle compilation pipeline.
    // This runs in the background — submit returns immediately.
    // Errors are logged but don't fail the submit response.
    triggerBundleCompilation(app, sessionId).catch((err) => {
      app.log.error({ sessionId, err }, "Bundle compilation trigger failed");
    });

    return { session_id: sessionId, status: "submitted" };
  });
}

/**
 * Trigger the bundle compilation pipeline for a submitted session.
 *
 * Pipeline:
 * 1. Fetch all annotations for the session
 * 2. For each annotation, submit summarize_annotation job
 * 3. Submit compile_bundle job with all annotations + summaries
 *
 * This is fire-and-forget from the submit handler.
 * The worker processes jobs asynchronously and updates bundles in the DB.
 *
 * Phase 1: sync HTTP calls to worker (simple).
 * Phase 2+: BullMQ/Redis queue for proper async processing.
 */
async function triggerBundleCompilation(
  app: FastifyInstance,
  sessionId: string,
): Promise<void> {
  const workerUrl = process.env["WORKER_AI_URL"] ?? "http://localhost:8001";
  const tracker = getErrorRateTracker(app);
  const worker = new WorkerClient({
    baseUrl: workerUrl,
    onDiagnostic: (event) => {
      const level = event.status === "completed" ? "info" : "warn";
      app.log[level]({
        diagnostic: "worker_job",
        ...event,
        sessionId,
      }, `Worker job ${event.job_type} ${event.status} (${event.duration_ms}ms, ${event.retries} retries)`);

      // Feed into error rate tracker for threshold alerting
      tracker.record(event);
    },
  });

  // Fetch all annotations for this session
  const sessionAnnotations = await app.db
    .select()
    .from(annotations)
    .where(eq(annotations.sessionId, sessionId));

  if (sessionAnnotations.length === 0) {
    app.log.info({ sessionId }, "No annotations to compile — skipping");
    return;
  }

  // Step 1: Summarize each annotation
  const summaries: Array<{ annotationId: string; summary: unknown }> = [];

  for (const annotation of sessionAnnotations) {
    try {
      const response = await worker.submitJob({
        job_id: randomUUID(),
        job_type: "summarize_annotation",
        payload: {
          annotation_id: annotation.id,
          type: annotation.type,
          raw_text: annotation.rawText,
          page_url: annotation.pageUrl,
          screenshot_url: annotation.screenshotUrl,
        },
        idempotency_key: `summarize:${annotation.id}`,
        created_at: new Date().toISOString(),
      });

      if (response.status === "completed") {
        summaries.push({ annotationId: annotation.id, summary: response.result });
      }
    } catch (err) {
      app.log.error({ annotationId: annotation.id, err }, "Summarize annotation failed");
    }
  }

  // Step 2: Compile bundle
  try {
    const compileResponse = await worker.submitJob<unknown, CompileBundleResult>({
      job_id: randomUUID(),
      job_type: "compile_bundle",
      payload: {
        session_id: sessionId,
        annotations: sessionAnnotations.map((a) => ({
          id: a.id,
          type: a.type,
          page_url: a.pageUrl,
          raw_text: a.rawText,
          viewport: a.viewport,
          dom_selector: a.domSelector,
          element_bbox: a.elementBbox,
          computed_styles: a.computedStyles,
          screenshot_url: a.screenshotUrl,
          reference_images: a.referenceImages,
        })),
        summaries,
      },
      idempotency_key: `compile:${sessionId}`,
      created_at: new Date().toISOString(),
    });

    // Step 3: Persist bundles to database
    if (compileResponse.status === "completed" && compileResponse.result?.bundles) {
      await persistBundles(app, sessionId, compileResponse.result.bundles);
    }
  } catch (err) {
    app.log.error({ sessionId, err }, "Compile bundle failed");
  }
}

/** Shape of compile_bundle worker result. */
interface CompileBundleResult {
  session_id: string;
  bundles: CompileBundleEntry[];
  bundle_count: number;
}

interface CompileBundleEntry {
  annotation_id: string;
  title: string;
  summary: string;
  normalized_task: string;
  category: string;
  severity: string;
  page_url: string;
  viewport?: unknown;
  screenshot_url?: string;
  dom_selector?: string;
  computed_styles?: Record<string, string>;
  client_raw_text: string;
  reference_images: string[];
  // Provenance — ALWAYS SEPARATE
  exact_source: unknown | null;
  resolved_component_stack: unknown[];
  resolution_mode: string;
  missing_reasons: string[];
  root_boundary_kind: string | null;
  // Derived
  component_candidates: unknown[];
  file_candidates: string[];
  design_candidates: unknown[];
  design_diff: unknown | null;
  // AI-generated
  acceptance_criteria: string[];
  constraints?: string[];
  confidence: Record<string, number>;
  unresolved_ambiguities?: string[];
  validation_steps: string[];
}

/**
 * Persist compiled bundles to the database.
 *
 * Each bundle corresponds to one annotation. The annotation's bundle_id FK
 * is updated to link back to the execution_bundle.
 *
 * Provenance fields (exact_source, resolved_component_stack) are stored
 * as SEPARATE jsonb columns — never merged.
 */
async function persistBundles(
  app: FastifyInstance,
  sessionId: string,
  bundles: CompileBundleEntry[],
): Promise<void> {
  // Look up session to get projectId
  const sessions = await app.db
    .select({ projectId: reviewSessions.projectId })
    .from(reviewSessions)
    .where(eq(reviewSessions.id, sessionId))
    .limit(1);

  const session = sessions[0];
  if (!session) {
    app.log.error({ sessionId }, "Session not found for bundle persistence");
    return;
  }

  for (const bundle of bundles) {
    try {
      const [inserted] = await app.db
        .insert(executionBundles)
        .values({
          projectId: session.projectId,
          sessionId,
          title: bundle.title,
          summary: bundle.summary,
          normalizedTask: bundle.normalized_task,
          category: bundle.category as "visual_bug" | "layout_issue" | "copy_change" | "feature_request" | "behavior_bug" | "accessibility" | "performance",
          severity: bundle.severity as "critical" | "major" | "minor" | "suggestion",
          pageUrl: bundle.page_url,
          viewport: bundle.viewport,
          screenshotUrl: bundle.screenshot_url,
          domSelector: bundle.dom_selector,
          computedStyles: bundle.computed_styles,
          clientRawText: bundle.client_raw_text,
          referenceImages: bundle.reference_images,
          // Provenance — SEPARATE fields
          exactSource: bundle.exact_source,
          resolvedComponentStack: bundle.resolved_component_stack,
          resolutionMode: bundle.resolution_mode as "fiber_meta" | "server_prefix" | "leaf_only" | "heuristic",
          missingReasons: bundle.missing_reasons,
          rootBoundaryKind: bundle.root_boundary_kind,
          // Derived
          componentCandidates: bundle.component_candidates,
          fileCandidates: bundle.file_candidates,
          designCandidates: bundle.design_candidates,
          designDiff: bundle.design_diff,
          // AI-generated
          acceptanceCriteria: bundle.acceptance_criteria,
          constraints: bundle.constraints ?? [],
          confidence: bundle.confidence,
          unresolvedAmbiguities: bundle.unresolved_ambiguities ?? [],
          validationSteps: bundle.validation_steps,
        })
        .returning({ id: executionBundles.id });

      // Link annotation to this bundle
      if (bundle.annotation_id && inserted) {
        await app.db
          .update(annotations)
          .set({ bundleId: inserted.id })
          .where(eq(annotations.id, bundle.annotation_id));
      }

      app.log.info({ bundleId: inserted?.id, annotationId: bundle.annotation_id }, "Bundle persisted");
    } catch (err) {
      app.log.error({ annotationId: bundle.annotation_id, err }, "Failed to persist bundle");
    }
  }
}
