/**
 * Figma candidate ranking service.
 *
 * Implements the v8 architecture:
 * - Code Connect path: deterministic identity resolution (confidence = 1.0)
 * - Non-Code-Connect path: candidate ranking with honest confidence scores
 *
 * Ranking signals (in priority order):
 * 1. exact_source component name match
 * 2. resolved_component_stack name matches
 * 3. visible text / title similarity
 * 4. DOM role/tag correlation
 * 5. page/route context matching
 * 6. Figma metadata signals (description, page name)
 *
 * Design rules:
 * - Code Connect = identity resolution, stops ranking
 * - Low-confidence matches do NOT produce automatic design diffs
 * - Every ranking operation emits a FigmaRankingTraceEvent
 * - DesignCandidate records include ranking_signals for transparency
 */

import type {
  DesignCandidate,
  FigmaComponentInfo,
  CodeConnectMapping,
  FigmaRankingResult,
  FigmaRankingTraceEvent,
  RankingSignal,
  ExactSource,
  ResolvedComponentFrame,
} from "@compyl/contracts";
import type { FigmaClient } from "./figma-client.js";

// =============================================================================
// Configuration
// =============================================================================

/** Confidence threshold below which design diff should NOT be computed. */
const DIFF_CONFIDENCE_THRESHOLD = 0.6;

/** Maximum candidates to return. */
const MAX_CANDIDATES = 5;

/** Signal weights for non-Code-Connect ranking. */
const SIGNAL_WEIGHTS = {
  exact_source_name: 0.35,
  component_stack_name: 0.25,
  visible_text: 0.15,
  dom_role: 0.05,
  page_context: 0.10,
  figma_metadata: 0.10,
} as const;

// =============================================================================
// Ranking context — what we know about the bundle
// =============================================================================

export interface RankingContext {
  bundle_id: string;
  /** Build-time exact source (from data-rl-source). */
  exact_source: ExactSource | null;
  /** Runtime-resolved ancestry. */
  resolved_component_stack: ResolvedComponentFrame[];
  /** Bundle title (visible text proxy). */
  title: string;
  /** DOM selector for the annotated element. */
  dom_selector: string;
  /** Page URL where annotation was made. */
  page_url: string;
  /** Figma file ID for this project. */
  figma_file_id: string;
}

// =============================================================================
// Trace emitter callback
// =============================================================================

export type RankingTraceEmitter = (trace: FigmaRankingTraceEvent) => void;

// =============================================================================
// Ranking service
// =============================================================================

export class FigmaRankingService {
  private client: FigmaClient;
  private traceEmitter: RankingTraceEmitter;

  constructor(client: FigmaClient, traceEmitter: RankingTraceEmitter) {
    this.client = client;
    this.traceEmitter = traceEmitter;
  }

  /**
   * Rank Figma components for a bundle.
   *
   * If Code Connect mappings resolve the component, returns identity resolution
   * (confidence = 1.0, is_code_connect = true). Otherwise, runs signal-based
   * ranking and returns honest confidence scores.
   */
  async rankCandidates(ctx: RankingContext): Promise<FigmaRankingResult> {
    const start = Date.now();

    // Fetch Figma data
    const [components, mappings] = await Promise.all([
      this.client.getFileComponents(ctx.figma_file_id),
      this.client.getCodeConnectMappings(ctx.figma_file_id),
    ]);

    // Try Code Connect identity resolution first
    const codeConnectResult = this.resolveViaCodeConnect(ctx, mappings, components);
    if (codeConnectResult) {
      const trace = this.buildTrace(ctx, codeConnectResult, true, components, start);
      this.traceEmitter(trace);
      return {
        candidates: codeConnectResult,
        code_connect_resolved: true,
        trace,
        should_compute_diff: true, // Code Connect = exact match, always diff
      };
    }

    // Fall back to signal-based ranking
    const ranked = this.rankBySignals(ctx, components);
    const topConfidence = ranked.length > 0 ? ranked[0]!.confidence : 0;
    const shouldDiff = topConfidence >= DIFF_CONFIDENCE_THRESHOLD;
    const noMatch = ranked.length === 0 || topConfidence < 0.1;

    const trace = this.buildTrace(ctx, ranked, false, components, start, noMatch);
    this.traceEmitter(trace);

    return {
      candidates: ranked,
      code_connect_resolved: false,
      trace,
      should_compute_diff: shouldDiff,
    };
  }

  // ---------------------------------------------------------------------------
  // Code Connect identity resolution
  // ---------------------------------------------------------------------------

  private resolveViaCodeConnect(
    ctx: RankingContext,
    mappings: CodeConnectMapping[],
    components: FigmaComponentInfo[],
  ): DesignCandidate[] | null {
    if (mappings.length === 0) return null;

    // Try exact_source first
    if (ctx.exact_source) {
      const mapping = mappings.find(
        (m) =>
          m.code_component === ctx.exact_source!.component_name &&
          (!m.code_file || m.code_file === ctx.exact_source!.file_path),
      );
      if (mapping) {
        return [this.codeConnectCandidate(mapping, components, "exact_source")];
      }
    }

    // Try resolved_component_stack (prefer leaf → root order)
    for (const frame of ctx.resolved_component_stack) {
      const mapping = mappings.find(
        (m) =>
          m.code_component === frame.component_name &&
          (!m.code_file || m.code_file === frame.file_path),
      );
      if (mapping) {
        return [this.codeConnectCandidate(mapping, components, "component_stack")];
      }
    }

    return null;
  }

  private codeConnectCandidate(
    mapping: CodeConnectMapping,
    components: FigmaComponentInfo[],
    resolvedVia: string,
  ): DesignCandidate {
    const component = components.find((c) => c.node_id === mapping.figma_node_id);
    return {
      component_id: mapping.figma_node_id,
      component_name: component?.name ?? mapping.figma_component_name,
      confidence: 1.0,
      is_code_connect: true,
      ranking_signals: [{
        signal: "code_connect",
        weight: 1.0,
        matched: true,
        detail: `Code Connect identity resolution via ${resolvedVia}: ${mapping.code_component} → ${mapping.figma_component_name}`,
      }],
    };
  }

  // ---------------------------------------------------------------------------
  // Signal-based ranking
  // ---------------------------------------------------------------------------

  private rankBySignals(
    ctx: RankingContext,
    components: FigmaComponentInfo[],
  ): DesignCandidate[] {
    if (components.length === 0) return [];

    const scored: Array<{ component: FigmaComponentInfo; score: number; signals: RankingSignal[] }> = [];

    for (const component of components) {
      const signals: RankingSignal[] = [];
      let totalScore = 0;

      // Signal 1: exact_source component name match
      const exactSourceMatch = this.matchExactSource(ctx.exact_source, component);
      signals.push(exactSourceMatch);
      totalScore += exactSourceMatch.matched ? SIGNAL_WEIGHTS.exact_source_name : 0;

      // Signal 2: component stack name match
      const stackMatch = this.matchComponentStack(ctx.resolved_component_stack, component);
      signals.push(stackMatch);
      totalScore += stackMatch.matched ? SIGNAL_WEIGHTS.component_stack_name : 0;

      // Signal 3: visible text / title similarity
      const textMatch = this.matchVisibleText(ctx.title, component);
      signals.push(textMatch);
      totalScore += textMatch.matched ? SIGNAL_WEIGHTS.visible_text * textMatch.weight : 0;

      // Signal 4: DOM role/tag correlation
      const domMatch = this.matchDomRole(ctx.dom_selector, component);
      signals.push(domMatch);
      totalScore += domMatch.matched ? SIGNAL_WEIGHTS.dom_role : 0;

      // Signal 5: page/route context
      const pageMatch = this.matchPageContext(ctx.page_url, component);
      signals.push(pageMatch);
      totalScore += pageMatch.matched ? SIGNAL_WEIGHTS.page_context : 0;

      // Signal 6: Figma metadata (description, page name)
      const metaMatch = this.matchFigmaMetadata(ctx, component);
      signals.push(metaMatch);
      totalScore += metaMatch.matched ? SIGNAL_WEIGHTS.figma_metadata : 0;

      if (totalScore > 0) {
        scored.push({ component, score: totalScore, signals });
      }
    }

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, MAX_CANDIDATES);

    return top.map(({ component, score, signals }) => ({
      component_id: component.node_id,
      component_name: component.name,
      confidence: Math.round(score * 100) / 100, // round to 2 decimal places
      is_code_connect: false,
      ranking_signals: signals.filter((s) => s.matched),
    }));
  }

  // ---------------------------------------------------------------------------
  // Individual signal matchers
  // ---------------------------------------------------------------------------

  private matchExactSource(
    exactSource: ExactSource | null,
    component: FigmaComponentInfo,
  ): RankingSignal {
    if (!exactSource) {
      return { signal: "exact_source_name", weight: SIGNAL_WEIGHTS.exact_source_name, matched: false, detail: "No exact_source available" };
    }
    const matched = normalizedMatch(exactSource.component_name, component.name);
    return {
      signal: "exact_source_name",
      weight: SIGNAL_WEIGHTS.exact_source_name,
      matched,
      detail: matched
        ? `exact_source "${exactSource.component_name}" matches Figma "${component.name}"`
        : `exact_source "${exactSource.component_name}" does not match "${component.name}"`,
    };
  }

  private matchComponentStack(
    stack: ResolvedComponentFrame[],
    component: FigmaComponentInfo,
  ): RankingSignal {
    if (stack.length === 0) {
      return { signal: "component_stack_name", weight: SIGNAL_WEIGHTS.component_stack_name, matched: false, detail: "Empty component stack" };
    }
    const matchedFrame = stack.find((frame) => normalizedMatch(frame.component_name, component.name));
    return {
      signal: "component_stack_name",
      weight: SIGNAL_WEIGHTS.component_stack_name,
      matched: !!matchedFrame,
      detail: matchedFrame
        ? `Stack frame "${matchedFrame.component_name}" matches Figma "${component.name}"`
        : `No stack frame matches "${component.name}"`,
    };
  }

  private matchVisibleText(title: string, component: FigmaComponentInfo): RankingSignal {
    if (!title) {
      return { signal: "visible_text", weight: 0, matched: false, detail: "No title available" };
    }
    const similarity = textSimilarity(title, component.name);
    const descSimilarity = component.description ? textSimilarity(title, component.description) : 0;
    const bestSimilarity = Math.max(similarity, descSimilarity);
    const matched = bestSimilarity > 0.3;
    return {
      signal: "visible_text",
      weight: bestSimilarity,
      matched,
      detail: matched
        ? `Text similarity ${bestSimilarity.toFixed(2)} with "${component.name}"`
        : `Low text similarity ${bestSimilarity.toFixed(2)} with "${component.name}"`,
    };
  }

  private matchDomRole(domSelector: string, component: FigmaComponentInfo): RankingSignal {
    if (!domSelector) {
      return { signal: "dom_role", weight: SIGNAL_WEIGHTS.dom_role, matched: false, detail: "No DOM selector" };
    }
    // Extract tag name or role from selector
    const tag = extractTagFromSelector(domSelector);
    const componentLower = component.name.toLowerCase();
    const matched = !!tag && (
      componentLower.includes(tag) ||
      DOM_ROLE_MAP[tag]?.some((role) => componentLower.includes(role)) === true
    );
    return {
      signal: "dom_role",
      weight: SIGNAL_WEIGHTS.dom_role,
      matched,
      detail: matched
        ? `DOM tag "${tag}" correlates with "${component.name}"`
        : `DOM tag "${tag || "unknown"}" does not correlate with "${component.name}"`,
    };
  }

  private matchPageContext(pageUrl: string, component: FigmaComponentInfo): RankingSignal {
    if (!pageUrl || !component.page_name) {
      return { signal: "page_context", weight: SIGNAL_WEIGHTS.page_context, matched: false, detail: "No page context available" };
    }
    // Extract route segment from URL
    const routeSegment = extractRouteSegment(pageUrl);
    const pageLower = component.page_name.toLowerCase();
    const matched = !!routeSegment && pageLower.includes(routeSegment);
    return {
      signal: "page_context",
      weight: SIGNAL_WEIGHTS.page_context,
      matched,
      detail: matched
        ? `Route "${routeSegment}" matches Figma page "${component.page_name}"`
        : `Route "${routeSegment || "/"}" does not match Figma page "${component.page_name}"`,
    };
  }

  private matchFigmaMetadata(ctx: RankingContext, component: FigmaComponentInfo): RankingSignal {
    if (!component.description && !component.variant_properties) {
      return { signal: "figma_metadata", weight: SIGNAL_WEIGHTS.figma_metadata, matched: false, detail: "No Figma metadata" };
    }

    // Check if component description mentions relevant terms from the bundle
    const searchTerms = [
      ctx.exact_source?.component_name,
      ...ctx.resolved_component_stack.map((f) => f.component_name),
      ctx.title,
    ].filter(Boolean).map((t) => t!.toLowerCase());

    const descLower = (component.description ?? "").toLowerCase();
    const matched = searchTerms.some((term) => descLower.includes(term));

    return {
      signal: "figma_metadata",
      weight: SIGNAL_WEIGHTS.figma_metadata,
      matched,
      detail: matched
        ? `Figma description mentions relevant component terms`
        : `Figma metadata does not reference bundle context`,
    };
  }

  // ---------------------------------------------------------------------------
  // Trace builder
  // ---------------------------------------------------------------------------

  private buildTrace(
    ctx: RankingContext,
    candidates: DesignCandidate[],
    codeConnectAvailable: boolean,
    allComponents: FigmaComponentInfo[],
    startMs: number,
    noMatch?: boolean,
  ): FigmaRankingTraceEvent {
    const signalsUsed = new Set<string>();
    for (const c of candidates) {
      for (const s of c.ranking_signals ?? []) {
        if (s.matched) signalsUsed.add(s.signal);
      }
    }

    const topConfidence = candidates.length > 0 ? candidates[0]!.confidence : 0;
    const reason = codeConnectAvailable
      ? `Code Connect identity resolution: ${candidates[0]?.component_name}`
      : noMatch
        ? `No matching Figma component found among ${allComponents.length} candidates`
        : `Signal-based ranking: top match "${candidates[0]?.component_name}" at ${topConfidence.toFixed(2)} confidence`;

    return {
      bundle_id: ctx.bundle_id,
      candidate_count: candidates.length,
      top_confidence: topConfidence,
      ranking_signals_used: [...signalsUsed],
      code_connect_available: codeConnectAvailable,
      duration_ms: Date.now() - startMs,
      candidate_list: candidates.map((c) => ({
        node_id: c.component_id,
        name: c.component_name,
        confidence: c.confidence,
      })),
      ranking_reason: reason,
      no_match: noMatch ?? (candidates.length === 0),
      fallback_used: noMatch ? "none" : undefined,
    };
  }
}

// =============================================================================
// Utility functions
// =============================================================================

/** Normalize a component name for comparison (lowercase, strip common suffixes). */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\-\s]/g, "")
    .replace(/component$/, "")
    .replace(/wrapper$/, "")
    .replace(/container$/, "");
}

/** Check if two component names match after normalization. */
function normalizedMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Simple text similarity based on shared words. */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }
  return shared / Math.max(wordsA.size, wordsB.size);
}

/** Extract leading tag name from a CSS selector. */
function extractTagFromSelector(selector: string): string | null {
  const match = selector.match(/^([a-z][a-z0-9]*)/i);
  return match ? match[1]!.toLowerCase() : null;
}

/** Extract the last meaningful route segment from a URL. */
function extractRouteSegment(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    // Skip dynamic segments (UUIDs, numeric IDs)
    const meaningful = segments.filter((s) => !s.match(/^[0-9a-f-]{8,}$/i) && !s.match(/^\d+$/));
    return meaningful[meaningful.length - 1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Map DOM tags to common Figma component role keywords. */
const DOM_ROLE_MAP: Record<string, string[]> = {
  button: ["button", "btn", "cta", "action"],
  input: ["input", "field", "text field", "textfield"],
  select: ["dropdown", "select", "picker"],
  textarea: ["textarea", "text area", "multiline"],
  img: ["image", "avatar", "icon", "thumbnail"],
  nav: ["navigation", "nav", "menu", "sidebar"],
  header: ["header", "appbar", "toolbar", "topbar"],
  footer: ["footer"],
  dialog: ["dialog", "modal", "popup", "overlay"],
  table: ["table", "data table", "grid"],
  form: ["form"],
  a: ["link", "anchor"],
  ul: ["list"],
  li: ["list item", "listitem"],
};
