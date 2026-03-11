/**
 * Runtime component stack resolver.
 *
 * Produces `resolved_component_stack` by walking React fiber tree
 * upward from a clicked DOM element and reading `__rlMeta` metadata.
 *
 * Architecture:
 * - exact_source comes from data-rl-source (build-time) — handled separately
 * - resolved_component_stack comes from this resolver (runtime)
 * - These are NEVER merged into one generic output
 *
 * This module reads React internals. It WILL break across major versions.
 * That's managed via version detection + adapter versioning + kill switch.
 */

import type {
  ResolvedComponentFrame,
  ResolutionMode,
  RootBoundaryKind,
  RlMeta,
  ResolutionTelemetryEvent,
  AdapterFailureEvent,
} from "@reviewlayer/contracts";

export interface ResolutionResult {
  /** Runtime-resolved ancestry. Array of frames, SEPARATE from exact_source. */
  resolved_component_stack: ResolvedComponentFrame[];
  /** How the stack was resolved. */
  resolution_mode: ResolutionMode;
  /** Why ancestry is partial or unavailable. */
  missing_reasons: string[];
  /** When ancestry stops at a known boundary. */
  root_boundary_kind: RootBoundaryKind | null;
  /** Telemetry event for observability. */
  telemetry: ResolutionTelemetryEvent;
}

// React fiber internal types (simplified — enough for walking)
interface Fiber {
  tag: number;
  type: FiberType;
  elementType: FiberType;
  return: Fiber | null;
  stateNode: unknown;
  memoizedProps: Record<string, unknown>;
}

interface FiberType {
  __rlMeta?: RlMeta;
  displayName?: string;
  name?: string;
  $$typeof?: symbol;
  render?: FiberType;
  type?: FiberType;
}

/** React fiber tag constants. */
const HOST_COMPONENT = 5;
const HOST_ROOT = 3;

export interface ResolverCallbacks {
  /** Called on adapter failure (for diagnostics and kill switch). */
  onFailure?: (event: AdapterFailureEvent) => void;
  /** Called after every resolution (success or fallback) for observability. */
  onTelemetry?: (event: ResolutionTelemetryEvent) => void;
}

/**
 * Resolve the component stack for a clicked DOM element.
 *
 * Returns the ancestry chain from the clicked element up to the root,
 * reading __rlMeta from instrumented components along the way.
 *
 * This function NEVER produces exact_source — that's a build-time concern.
 */
export function resolveComponentStack(
  element: Element,
  callbacksOrOnFailure?: ResolverCallbacks | ((event: AdapterFailureEvent) => void),
): ResolutionResult {
  // Support both old (onFailure callback) and new (callbacks object) signatures
  const callbacks: ResolverCallbacks = typeof callbacksOrOnFailure === "function"
    ? { onFailure: callbacksOrOnFailure }
    : callbacksOrOnFailure ?? {};
  const startTime = performance.now();
  const missing_reasons: string[] = [];
  let root_boundary_kind: RootBoundaryKind | null = null;
  let fiberDepth = 0;

  try {
    // Find the fiber node for this DOM element
    const fiber = getFiberFromElement(element);
    if (!fiber) {
      return makeLeafOnlyResult(startTime, ["no_fiber_found"], callbacks.onTelemetry);
    }

    const frames: ResolvedComponentFrame[] = [];
    let current: Fiber | null = fiber;
    let hasRlMeta = false;

    // Walk up the fiber tree
    while (current) {
      fiberDepth++;

      // Check for root boundaries
      if (current.tag === HOST_ROOT) {
        if (fiberDepth > 1) {
          // Might be a portal or separate root
          root_boundary_kind = detectBoundaryKind(current);
        }
        break;
      }

      // Read component metadata
      const meta = extractMeta(current);
      if (meta) {
        hasRlMeta = true;
        frames.push({
          component_name: meta.name,
          file_path: meta.file,
          line: meta.line,
          line_kind: "definition", // ancestor frames are always definition-level
          is_library: meta.isLibrary,
        });
      } else if (current.tag !== HOST_COMPONENT) {
        // Uninstrumented component — still record it
        const name = getComponentName(current);
        if (name) {
          frames.push({
            component_name: name,
            line_kind: "definition",
            is_library: true, // assume uninstrumented = third-party
          });
          missing_reasons.push(`no_rl_meta:${name}`);
        }
      }

      current = current.return;
    }

    const duration_ms = performance.now() - startTime;
    const resolution_mode: ResolutionMode = hasRlMeta ? "fiber_meta" : "heuristic";

    if (frames.length === 0) {
      missing_reasons.push("no_components_found");
    }

    const telemetry: ResolutionTelemetryEvent = {
      resolution_mode,
      frame_count: frames.length,
      missing_reasons,
      exact_source_available: false, // determined separately from data-rl-source
      duration_ms,
    };
    callbacks.onTelemetry?.(telemetry);

    return {
      resolved_component_stack: frames,
      resolution_mode,
      missing_reasons,
      root_boundary_kind,
      telemetry,
    };
  } catch (err) {
    const failureEvent: AdapterFailureEvent = {
      react_version: detectReactVersionQuick(),
      failure_type: err instanceof Error ? err.message : "unknown",
      fallback_mode: "leaf_only",
      fiber_depth_reached: fiberDepth,
    };

    callbacks.onFailure?.(failureEvent);

    return makeLeafOnlyResult(startTime, [
      `adapter_error:${failureEvent.failure_type}`,
    ], callbacks.onTelemetry);
  }
}

function makeLeafOnlyResult(
  startTime: number,
  reasons: string[],
  onTelemetry?: (event: ResolutionTelemetryEvent) => void,
): ResolutionResult {
  const duration_ms = performance.now() - startTime;
  const telemetry: ResolutionTelemetryEvent = {
    resolution_mode: "leaf_only",
    frame_count: 0,
    missing_reasons: reasons,
    exact_source_available: false,
    duration_ms,
  };
  onTelemetry?.(telemetry);
  return {
    resolved_component_stack: [],
    resolution_mode: "leaf_only",
    missing_reasons: reasons,
    root_boundary_kind: null,
    telemetry,
  };
}

/**
 * Get the React fiber node for a DOM element.
 * React stores fiber references on DOM nodes with internal key prefixes.
 */
function getFiberFromElement(element: Element): Fiber | null {
  // React 18/19 use __reactFiber$ prefix
  for (const key of Object.keys(element)) {
    if (key.startsWith("__reactFiber$")) {
      return (element as unknown as Record<string, Fiber>)[key] ?? null;
    }
  }
  // React 16/17 fallback
  for (const key of Object.keys(element)) {
    if (key.startsWith("__reactInternalInstance$")) {
      return (element as unknown as Record<string, Fiber>)[key] ?? null;
    }
  }
  return null;
}

/** Extract __rlMeta from a fiber, handling memo/forwardRef/lazy wrappers. */
function extractMeta(fiber: Fiber): RlMeta | null {
  const type = fiber.type ?? fiber.elementType;
  if (!type) return null;

  // Direct meta
  if (type.__rlMeta) return type.__rlMeta;

  // forwardRef: type.render
  if (type.render?.__rlMeta) return type.render.__rlMeta;

  // memo: type.type
  if (type.type?.__rlMeta) return type.type.__rlMeta;

  // memo(forwardRef): type.type.render
  if (type.type?.render?.__rlMeta) return type.type.render.__rlMeta;

  return null;
}

/** Get a display name for uninstrumented components. */
function getComponentName(fiber: Fiber): string | null {
  const type = fiber.type ?? fiber.elementType;
  if (!type) return null;

  if (typeof type === "string") return null; // HTML element
  if (type.displayName) return type.displayName;
  if (type.name) return type.name;
  if (type.render?.displayName) return type.render.displayName;
  if (type.render?.name) return type.render.name;

  return null;
}

/** Detect if a root fiber represents a known boundary type. */
function detectBoundaryKind(fiber: Fiber): RootBoundaryKind | null {
  // Portal detection: React portals have a specific stateNode structure
  if (fiber.stateNode && typeof fiber.stateNode === "object") {
    const state = fiber.stateNode as Record<string, unknown>;
    if (state["containerInfo"] && state["containerInfo"] !== document.getElementById("root")) {
      return "portal";
    }
  }
  return "separate_root";
}

/** Quick React version detection (for error reporting). */
function detectReactVersionQuick(): string {
  try {
    // React exposes version on the module
    const React = (globalThis as unknown as Record<string, { version?: string }>)["React"];
    return React?.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
