/**
 * React version detection.
 *
 * The adapter needs to know which React version is running to:
 * 1. Choose the right fiber key prefix
 * 2. Handle version-specific internal structure
 * 3. Report version in telemetry and failure events
 */

export interface ReactVersionInfo {
  /** Full version string (e.g. "18.2.0"). */
  version: string;
  /** Major version number. */
  major: number;
  /** Whether this version is supported by the adapter. */
  supported: boolean;
  /** Fiber key prefix used for DOM→fiber lookup. */
  fiberKeyPrefix: string;
}

/** Supported React major versions. */
const SUPPORTED_MAJORS = new Set([18, 19]);

/**
 * Detect the running React version.
 *
 * Inspects the DOM for React fiber key patterns and reads
 * the React module version if available.
 */
export function detectReactVersion(): ReactVersionInfo {
  // Try to find React version from the global or module
  let version = "unknown";
  let major = 0;

  try {
    // Check for React on window (development builds)
    const win = globalThis as unknown as Record<string, unknown>;
    const devTools = win["__REACT_DEVTOOLS_GLOBAL_HOOK__"] as
      | { renderers?: Map<number, { version?: string }> }
      | undefined;

    if (devTools?.renderers) {
      for (const renderer of devTools.renderers.values()) {
        if (renderer.version) {
          version = renderer.version;
          major = parseInt(version.split(".")[0] ?? "0", 10);
          break;
        }
      }
    }
  } catch {
    // Silent — version detection is best-effort
  }

  // Determine fiber key prefix based on version
  const fiberKeyPrefix = major >= 18 ? "__reactFiber$" : "__reactInternalInstance$";

  return {
    version,
    major,
    supported: SUPPORTED_MAJORS.has(major),
    fiberKeyPrefix,
  };
}
