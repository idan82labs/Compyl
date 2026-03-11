/**
 * @compyl/swc-plugin — Build-time instrumentation for Compyl.
 *
 * OWNERSHIP BOUNDARY:
 * This plugin owns ONLY build-time artifacts:
 *   1. `data-rl-source` attribute on host DOM elements (→ exact_source)
 *   2. `__rlMeta` metadata on component exports (→ used by react-adapter at runtime)
 *
 * This plugin does NOT own:
 *   - Runtime component stack resolution (→ packages/react-adapter)
 *   - Full ancestry / fiber walking (→ packages/react-adapter)
 *   - `data-rl-stack` (FORBIDDEN — not a real build-time artifact)
 *
 * Architecture:
 *   Build-time: plugin emits markers → data-rl-source + __rlMeta
 *   Runtime: react-adapter reads markers → resolved_component_stack
 *   These are SEPARATE concerns, NEVER merged.
 */

import type { RlMeta } from "@compyl/contracts";

// =============================================================================
// Plugin configuration
// =============================================================================

export interface PluginOptions {
  /**
   * File patterns to instrument. Defaults to common React file extensions.
   * Uses minimatch-style globs.
   */
  include?: string[];

  /**
   * File patterns to exclude from instrumentation.
   * node_modules is always excluded.
   */
  exclude?: string[];

  /**
   * Whether to strip all instrumentation in production builds.
   * Default: true (strip markers in production).
   */
  stripInProduction?: boolean;

  /**
   * Base directory for computing relative file paths in source markers.
   * Defaults to process.cwd().
   */
  rootDir?: string;

  /**
   * Mark components from this package as library components (is_library: true).
   * Used when the plugin instruments a design system or shared library.
   */
  isLibrary?: boolean;
}

const DEFAULT_INCLUDE = ["**/*.tsx", "**/*.jsx"];
const DEFAULT_EXCLUDE = ["node_modules/**", "**/*.test.*", "**/*.spec.*", "**/__tests__/**"];

// =============================================================================
// Source marker: data-rl-source
// =============================================================================

/**
 * Encode a source marker for the data-rl-source attribute.
 *
 * Format: "ComponentName|relative/path/to/file.tsx|lineNumber"
 *
 * This is attached to host DOM elements (div, span, button, etc.) at the
 * exact JSX render site. The backend parses this into an ExactSource object.
 *
 * IMPORTANT: This marks the LEAF render site only — where the DOM element
 * is actually emitted. It does NOT encode ancestry or component stack.
 */
export function encodeSourceMarker(
  componentName: string,
  filePath: string,
  line: number,
): string {
  return `${componentName}|${filePath}|${line}`;
}

/**
 * Parse a data-rl-source attribute value back into its components.
 * Used by the backend to construct ExactSource.
 *
 * Returns null if the format is invalid.
 */
export function parseSourceMarker(
  marker: string,
): { componentName: string; filePath: string; line: number } | null {
  const parts = marker.split("|");
  if (parts.length !== 3) return null;

  const [componentName, filePath, lineStr] = parts;
  const line = parseInt(lineStr!, 10);

  if (!componentName || !filePath || isNaN(line)) return null;

  return { componentName, filePath, line };
}

// =============================================================================
// Component metadata: __rlMeta
// =============================================================================

/**
 * Create an RlMeta object for attaching to a component export.
 *
 * In the actual SWC/Babel transform, this would be emitted as:
 *   MyComponent.__rlMeta = { id: 1, name: "MyComponent", file: "src/Button.tsx", line: 5, isLibrary: false };
 *
 * The react-adapter reads __rlMeta during fiber walks to build
 * resolved_component_stack frames.
 */
export function createRlMeta(
  id: number,
  name: string,
  file: string,
  line: number,
  isLibrary: boolean,
): RlMeta {
  return { id, name, file, line, isLibrary };
}

/**
 * Attach __rlMeta to a component function/class.
 *
 * This is the runtime equivalent of what the SWC/Babel transform emits.
 * The transform would generate:
 *   export function Button() { ... }
 *   Button.__rlMeta = { id: 42, name: "Button", file: "src/Button.tsx", line: 5, isLibrary: false };
 *
 * This utility is used for:
 *   1. Tests that verify metadata attachment
 *   2. Manual instrumentation fallback (when build plugin isn't available)
 */
export function attachRlMeta(
  component: { __rlMeta?: RlMeta },
  meta: RlMeta,
): void {
  component.__rlMeta = meta;
}

// =============================================================================
// Wrapper-aware metadata attachment
// =============================================================================

/**
 * Attach __rlMeta to a component that may be wrapped in memo/forwardRef.
 *
 * React's memo() and forwardRef() create wrapper objects with specific shapes.
 * The react-adapter's extractMeta() knows how to find __rlMeta in:
 *   - Direct: component.__rlMeta
 *   - forwardRef: component.render.__rlMeta
 *   - memo: component.type.__rlMeta
 *   - memo(forwardRef): component.type.render.__rlMeta
 *
 * This function attaches metadata at the right level so the adapter can find it.
 * In the real SWC/Babel transform, this is handled by analyzing the export shape.
 */
export function attachRlMetaToWrapped(
  wrappedComponent: Record<string, unknown>,
  meta: RlMeta,
): void {
  // React memo: { $$typeof: Symbol(react.memo), type: innerComponent }
  // React forwardRef: { $$typeof: Symbol(react.forward_ref), render: innerFunction }

  const $$typeof = wrappedComponent["$$typeof"];

  if ($$typeof && typeof $$typeof === "symbol") {
    const typeofStr = $$typeof.toString();

    if (typeofStr === "Symbol(react.memo)") {
      // memo(Component) → attach to .type
      const inner = wrappedComponent["type"] as Record<string, unknown> | undefined;
      if (inner) {
        // Check if inner is also a forwardRef
        const innerTypeof = inner["$$typeof"];
        if (innerTypeof && typeof innerTypeof === "symbol" &&
            innerTypeof.toString() === "Symbol(react.forward_ref)") {
          // memo(forwardRef(Component)) → attach to .type.render
          const render = inner["render"] as Record<string, unknown> | undefined;
          if (render) {
            render["__rlMeta"] = meta;
            return;
          }
        }
        inner["__rlMeta"] = meta;
        return;
      }
    }

    if (typeofStr === "Symbol(react.forward_ref)") {
      // forwardRef(Component) → attach to .render
      const render = wrappedComponent["render"] as Record<string, unknown> | undefined;
      if (render) {
        render["__rlMeta"] = meta;
        return;
      }
    }
  }

  // Direct component (function or class)
  wrappedComponent["__rlMeta"] = meta;
}

// =============================================================================
// File path utilities
// =============================================================================

/**
 * Compute the relative file path for source markers.
 * Strips the root directory prefix and normalizes separators.
 */
export function computeRelativePath(absolutePath: string, rootDir: string): string {
  let normalized = absolutePath.replace(/\\/g, "/");
  const normalizedRoot = rootDir.replace(/\\/g, "/").replace(/\/$/, "") + "/";

  if (normalized.startsWith(normalizedRoot)) {
    normalized = normalized.slice(normalizedRoot.length);
  }

  return normalized;
}

/**
 * Check if a file should be instrumented based on include/exclude patterns.
 *
 * In the real SWC/Babel plugin, this uses proper glob matching.
 * This scaffold uses simple extension matching for testing.
 */
export function shouldInstrument(
  filePath: string,
  options: PluginOptions = {},
): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Always exclude node_modules
  if (normalizedPath.includes("node_modules/")) return false;

  // Check exclude patterns (simple suffix/contains matching for scaffold)
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  for (const pattern of exclude) {
    if (matchSimplePattern(normalizedPath, pattern)) return false;
  }

  // Check include patterns
  const include = options.include ?? DEFAULT_INCLUDE;
  for (const pattern of include) {
    if (matchSimplePattern(normalizedPath, pattern)) return true;
  }

  return false;
}

/** Simple pattern matching for scaffold. Real plugin uses minimatch or SWC's glob. */
function matchSimplePattern(path: string, pattern: string): boolean {
  // Handle **/*.ext patterns
  if (pattern.startsWith("**/")) {
    const suffix = pattern.slice(3);
    if (suffix.startsWith("*.")) {
      const ext = suffix.slice(1); // e.g., ".tsx" or ".test.*"
      if (ext.endsWith(".*")) {
        // Wildcard suffix: **/*.test.* → contains ".test."
        const infix = ext.slice(0, -2); // ".test"
        return path.includes(infix + ".");
      }
      // Extension match: **/*.tsx → .tsx
      return path.endsWith(ext);
    }
    // Directory match: **/__tests__/** → __tests__/
    const dirName = suffix.replace("/**", "");
    return path.includes(`/${dirName}/`) || path.includes(`${dirName}/`);
  }

  // Simple contains
  return path.includes(pattern);
}

// =============================================================================
// Plugin configuration normalization
// =============================================================================

export interface NormalizedPluginOptions {
  include: string[];
  exclude: string[];
  stripInProduction: boolean;
  rootDir: string;
  isLibrary: boolean;
}

export function normalizeOptions(options: PluginOptions = {}): NormalizedPluginOptions {
  return {
    include: options.include ?? DEFAULT_INCLUDE,
    exclude: options.exclude ?? DEFAULT_EXCLUDE,
    stripInProduction: options.stripInProduction ?? true,
    rootDir: options.rootDir ?? process.cwd(),
    isLibrary: options.isLibrary ?? false,
  };
}

// =============================================================================
// AST transform scaffold
// =============================================================================

/**
 * Describes the transforms this plugin applies to a single file.
 *
 * This is the scaffold interface — the real SWC/Babel implementation
 * will produce these transforms from AST analysis.
 *
 * The plugin ONLY produces:
 * 1. SourceMarkerInsertion — adds data-rl-source to host DOM JSX elements
 * 2. MetadataAttachment — adds __rlMeta to component exports
 *
 * The plugin NEVER produces:
 * - data-rl-stack (FORBIDDEN)
 * - Full ancestry encoding
 * - Runtime resolution logic
 */
export interface FileTransformResult {
  /** Source markers to insert on host DOM elements. */
  sourceMarkers: SourceMarkerInsertion[];
  /** Metadata attachments for component exports. */
  metadataAttachments: MetadataAttachment[];
  /** Counter for generating unique IDs within this file. */
  nextId: number;
}

export interface SourceMarkerInsertion {
  /** The JSX element tag name (e.g., "div", "span", "button"). Must be a host element. */
  elementTag: string;
  /** Line number in the source file where this JSX element appears. */
  line: number;
  /** The component that renders this element. */
  componentName: string;
  /** Relative file path. */
  filePath: string;
  /** The encoded data-rl-source value. */
  markerValue: string;
}

export interface MetadataAttachment {
  /** The exported component name. */
  componentName: string;
  /** The __rlMeta to attach. */
  meta: RlMeta;
}

/**
 * Plan transforms for a single file (scaffold version).
 *
 * In the real implementation, this would parse the AST and identify:
 * 1. Component definitions (function declarations, arrow functions, classes)
 * 2. Host DOM JSX elements at their render sites
 * 3. Export statements to determine which components get __rlMeta
 *
 * This scaffold version accepts pre-analyzed component info and
 * produces the correct transform descriptors.
 */
export function planFileTransforms(
  filePath: string,
  components: ComponentInfo[],
  options: NormalizedPluginOptions,
): FileTransformResult {
  const result: FileTransformResult = {
    sourceMarkers: [],
    metadataAttachments: [],
    nextId: 1,
  };

  const relativePath = computeRelativePath(filePath, options.rootDir);

  for (const component of components) {
    const id = result.nextId++;
    const meta = createRlMeta(id, component.name, relativePath, component.definitionLine, options.isLibrary);

    // Metadata attachment for the component export
    result.metadataAttachments.push({
      componentName: component.name,
      meta,
    });

    // Source markers for host DOM elements rendered by this component
    for (const hostElement of component.hostElements) {
      const markerValue = encodeSourceMarker(component.name, relativePath, hostElement.line);
      result.sourceMarkers.push({
        elementTag: hostElement.tag,
        line: hostElement.line,
        componentName: component.name,
        filePath: relativePath,
        markerValue,
      });
    }
  }

  return result;
}

/** Pre-analyzed component info (input to planFileTransforms). */
export interface ComponentInfo {
  name: string;
  definitionLine: number;
  hostElements: HostElementInfo[];
}

/** A host DOM element rendered by a component. */
export interface HostElementInfo {
  tag: string;
  line: number;
}
