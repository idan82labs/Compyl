/**
 * Worker error rate tracker with threshold-based alerting.
 *
 * Tracks job outcomes in a sliding time window and fires an alert callback
 * when the error rate exceeds the configured threshold. Fires a recovery
 * event when the rate drops back below threshold.
 *
 * Designed to be fed from the WorkerClient diagnostic callback.
 */

import type { ApiJobDiagnosticEvent, WorkerErrorRateAlert } from "@reviewlayer/contracts";

export type ErrorRateAlertCallback = (alert: WorkerErrorRateAlert) => void;

export interface ErrorRateTrackerConfig {
  /** Error rate threshold (0-1). Default: 0.05 (5%). */
  threshold?: number;
  /** Sliding window duration in ms. Default: 300_000 (5 minutes). */
  windowMs?: number;
  /** Minimum jobs in window before alerting. Prevents false alarms on sparse traffic. Default: 10. */
  minSampleSize?: number;
  /** Called when error rate crosses threshold or recovers. */
  onAlert: ErrorRateAlertCallback;
}

interface JobOutcome {
  timestamp: number;
  failed: boolean;
}

const SUCCESS_STATUSES = new Set(["completed", "partial"]);

export class WorkerErrorRateTracker {
  private readonly threshold: number;
  private readonly windowMs: number;
  private readonly minSampleSize: number;
  private readonly onAlert: ErrorRateAlertCallback;
  private readonly outcomes: JobOutcome[] = [];
  private alertActive = false;

  constructor(config: ErrorRateTrackerConfig) {
    this.threshold = config.threshold ?? 0.05;
    this.windowMs = config.windowMs ?? 300_000;
    this.minSampleSize = config.minSampleSize ?? 10;
    this.onAlert = config.onAlert;
  }

  /**
   * Record a diagnostic event outcome. Call this from the WorkerClient
   * onDiagnostic callback.
   */
  record(event: ApiJobDiagnosticEvent): void {
    const failed = !SUCCESS_STATUSES.has(event.status);
    this.outcomes.push({ timestamp: Date.now(), failed });
    this.evaluate();
  }

  /**
   * Record with explicit timestamp (for testing).
   */
  recordAt(event: ApiJobDiagnosticEvent, timestamp: number): void {
    const failed = !SUCCESS_STATUSES.has(event.status);
    this.outcomes.push({ timestamp, failed });
    this.evaluateAt(timestamp);
  }

  /** Current error rate in the active window. */
  get errorRate(): number {
    return this.computeRate(Date.now());
  }

  /** Whether an alert is currently active. */
  get isAlertActive(): boolean {
    return this.alertActive;
  }

  private evaluate(): void {
    this.evaluateAt(Date.now());
  }

  private evaluateAt(now: number): void {
    this.pruneAt(now);

    const total = this.outcomes.length;
    if (total < this.minSampleSize) return;

    const failedCount = this.outcomes.filter((o) => o.failed).length;
    const rate = failedCount / total;

    if (rate > this.threshold && !this.alertActive) {
      this.alertActive = true;
      this.onAlert({
        error_rate: rate,
        threshold: this.threshold,
        window_ms: this.windowMs,
        total_jobs: total,
        failed_jobs: failedCount,
        recovered: false,
      });
    } else if (rate <= this.threshold && this.alertActive) {
      this.alertActive = false;
      this.onAlert({
        error_rate: rate,
        threshold: this.threshold,
        window_ms: this.windowMs,
        total_jobs: total,
        failed_jobs: failedCount,
        recovered: true,
      });
    }
  }

  private pruneAt(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.outcomes.length > 0 && this.outcomes[0]!.timestamp < cutoff) {
      this.outcomes.shift();
    }
  }

  private computeRate(now: number): number {
    this.pruneAt(now);
    if (this.outcomes.length === 0) return 0;
    const failedCount = this.outcomes.filter((o) => o.failed).length;
    return failedCount / this.outcomes.length;
  }
}
