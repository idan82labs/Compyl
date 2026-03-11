/**
 * Adapter kill switch.
 *
 * Monitors adapter failure rate and degrades to leaf_only mode
 * when failures exceed a configurable threshold.
 *
 * Per docs/08: "Kill switch triggers when adapter failure rate exceeds
 * threshold (configurable, default 10% over 5-minute window)"
 */

export interface KillSwitchConfig {
  /** Failure rate threshold (0-1). Default: 0.10 (10%). */
  threshold: number;
  /** Window size in milliseconds. Default: 5 minutes. */
  windowMs: number;
}

export interface KillSwitch {
  /** Record a resolution attempt. */
  recordAttempt(success: boolean): void;
  /** Check if the kill switch is tripped. */
  isTripped(): boolean;
  /** Get current failure rate. */
  getFailureRate(): number;
  /** Reset the kill switch (e.g., after a deployment). */
  reset(): void;
}

interface Attempt {
  timestamp: number;
  success: boolean;
}

const DEFAULT_CONFIG: KillSwitchConfig = {
  threshold: 0.10,
  windowMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Create a kill switch instance.
 *
 * When the failure rate exceeds the threshold within the window,
 * the adapter should degrade to leaf_only mode (no fiber walk).
 */
export function createKillSwitch(
  config: Partial<KillSwitchConfig> = {},
): KillSwitch {
  const cfg: KillSwitchConfig = { ...DEFAULT_CONFIG, ...config };
  let attempts: Attempt[] = [];

  function pruneOld(): void {
    const cutoff = Date.now() - cfg.windowMs;
    attempts = attempts.filter((a) => a.timestamp >= cutoff);
  }

  return {
    recordAttempt(success: boolean): void {
      attempts.push({ timestamp: Date.now(), success });
      pruneOld();
    },

    isTripped(): boolean {
      pruneOld();
      if (attempts.length < 5) return false; // need minimum sample
      const failures = attempts.filter((a) => !a.success).length;
      return failures / attempts.length >= cfg.threshold;
    },

    getFailureRate(): number {
      pruneOld();
      if (attempts.length === 0) return 0;
      const failures = attempts.filter((a) => !a.success).length;
      return failures / attempts.length;
    },

    reset(): void {
      attempts = [];
    },
  };
}
