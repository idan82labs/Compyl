/**
 * API → Worker HTTP client.
 *
 * Implements the provisional API↔Worker contract from CLAUDE.md:
 * - Typed requests/responses from @compyl/contracts
 * - Idempotency key on every request
 * - Timeout tiers: 30s default, 60s for design diff, 120s for bundle compilation
 * - Retry: up to 3x exponential backoff (1s, 4s, 16s) for retryable errors only
 */

import type {
  WorkerJobType,
  WorkerJobRequest,
  WorkerJobResponse,
  ApiJobDiagnosticEvent,
} from "@compyl/contracts";

/** Timeout per job type (ms). */
const TIMEOUT_MS: Record<WorkerJobType, number> = {
  summarize_annotation: 30_000,
  generate_clarification: 30_000,
  enrich_bundle: 30_000,
  compute_design_diff: 60_000,
  compile_bundle: 120_000,
  generate_acceptance_criteria: 30_000,
};

/** Retry backoff delays (ms). */
const RETRY_DELAYS = [1_000, 4_000, 16_000] as const;

export type DiagnosticCallback = (event: ApiJobDiagnosticEvent) => void;

export interface WorkerClientConfig {
  baseUrl: string;
  /** Called after every job completes (success or failure). */
  onDiagnostic?: DiagnosticCallback;
}

export class WorkerClient {
  private readonly baseUrl: string;
  private readonly onDiagnostic?: DiagnosticCallback;

  constructor(config: WorkerClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.onDiagnostic = config.onDiagnostic;
  }

  /**
   * Send a job to the worker and return the typed response.
   * Handles timeout, retry, and idempotency.
   * Emits a diagnostic event on every completion (success or failure).
   */
  async submitJob<TPayload, TResult>(
    request: WorkerJobRequest<TPayload>,
  ): Promise<WorkerJobResponse<TResult>> {
    const timeoutMs = TIMEOUT_MS[request.job_type];
    let lastError: Error | undefined;
    let retries = 0;
    const startMs = Date.now();

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const response = await this.doRequest<TPayload, TResult>(request, timeoutMs);

        if (response.status === "failed" && response.error?.retryable && attempt < RETRY_DELAYS.length) {
          lastError = new Error(response.error.message);
          retries++;
          await this.sleep(RETRY_DELAYS[attempt]!);
          continue;
        }

        this.emitDiagnostic(request, response.status, Date.now() - startMs, retries, response.error?.code, response.error?.message, response.duration_ms);
        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        retries++;

        if (attempt < RETRY_DELAYS.length) {
          await this.sleep(RETRY_DELAYS[attempt]!);
          continue;
        }
      }
    }

    // All retries exhausted
    const isTimeout = lastError?.name === "AbortError";
    this.emitDiagnostic(request, isTimeout ? "timeout" : "network_error", Date.now() - startMs, retries, isTimeout ? "TIMEOUT" : "NETWORK_ERROR", lastError?.message);
    throw lastError ?? new Error("Worker request failed after retries");
  }

  private emitDiagnostic(
    request: WorkerJobRequest<unknown>,
    status: ApiJobDiagnosticEvent["status"],
    durationMs: number,
    retries: number,
    errorCode?: string,
    errorMessage?: string,
    workerDurationMs?: number,
  ): void {
    if (!this.onDiagnostic) return;

    const payload = request.payload as Record<string, unknown> | undefined;
    this.onDiagnostic({
      job_id: request.job_id,
      job_type: request.job_type,
      status,
      duration_ms: durationMs,
      retries,
      error_code: errorCode,
      error_message: errorMessage,
      idempotency_key: request.idempotency_key,
      session_id: payload?.["session_id"] as string | undefined,
      annotation_id: payload?.["annotation_id"] as string | undefined,
      worker_duration_ms: workerDurationMs,
    });
  }

  private async doRequest<TPayload, TResult>(
    request: WorkerJobRequest<TPayload>,
    timeoutMs: number,
  ): Promise<WorkerJobResponse<TResult>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Worker returned HTTP ${res.status}: ${await res.text()}`);
      }

      return (await res.json()) as WorkerJobResponse<TResult>;
    } finally {
      clearTimeout(timer);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
