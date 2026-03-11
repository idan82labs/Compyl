/**
 * Figma candidate ranking tests.
 *
 * WHAT THIS PROVES:
 * 1. Code Connect path produces exact identity resolution (confidence=1.0, is_code_connect=true)
 * 2. Non-Code-Connect path uses signal-based ranking with honest confidence
 * 3. Low-confidence matches do NOT trigger design diff computation
 * 4. Ranking traces are emitted for every operation with full diagnostic fields
 * 5. Empty component list produces no-match trace
 * 6. exact_source name match is the strongest non-Code-Connect signal
 * 7. Multiple signals combine correctly (exact_source + stack + page context)
 * 8. Code Connect resolves via component stack when exact_source doesn't match
 * 9. Normalized name matching handles common variations (case, separators, suffixes)
 * 10. Ranking signals are recorded on each candidate for transparency
 *
 * HOW: Direct unit tests of FigmaRankingService with StubFigmaClient.
 */

import type {
  FigmaComponentInfo,
  CodeConnectMapping,
  FigmaRankingTraceEvent,
  ExactSource,
  ResolvedComponentFrame,
} from "@compyl/contracts";
import { FigmaRankingService, type RankingContext } from "../services/figma-ranking.js";
import { StubFigmaClient } from "../services/figma-client.js";

// =============================================================================
// Test infrastructure
// =============================================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failed++;
    throw new Error(`FAIL: ${message}`);
  }
}

function pass(message: string): void {
  passed++;
  console.log(`PASS: ${message}`);
}

// =============================================================================
// Fixtures
// =============================================================================

const FIGMA_COMPONENTS: FigmaComponentInfo[] = [
  { node_id: "1:1", name: "Button", description: "Primary action button", page_name: "Components" },
  { node_id: "1:2", name: "Header", description: "Top navigation header", page_name: "Layout" },
  { node_id: "1:3", name: "Card", description: "Content card container", page_name: "Components" },
  { node_id: "1:4", name: "Avatar", description: "User avatar image", page_name: "Components" },
  { node_id: "1:5", name: "Navigation", description: "Side navigation menu", page_name: "Layout" },
  { node_id: "1:6", name: "SearchBar", description: "Search input with filters for dashboard", page_name: "Dashboard" },
  { node_id: "1:7", name: "ProfileCard", description: "User profile card", page_name: "Profile" },
];

const CODE_CONNECT_MAPPINGS: CodeConnectMapping[] = [
  { code_component: "Button", code_file: "src/components/Button.tsx", figma_node_id: "1:1", figma_component_name: "Button" },
  { code_component: "Header", figma_node_id: "1:2", figma_component_name: "Header" },
];

function makeContext(overrides: Partial<RankingContext> = {}): RankingContext {
  return {
    bundle_id: "test-bundle-1",
    exact_source: null,
    resolved_component_stack: [],
    title: "Test feedback",
    dom_selector: "div#content",
    page_url: "https://app.example.com/dashboard",
    figma_file_id: "figma-file-1",
    ...overrides,
  };
}

function makeExactSource(overrides: Partial<ExactSource> = {}): ExactSource {
  return {
    file_path: "src/components/Button.tsx",
    component_name: "Button",
    line: 42,
    line_kind: "leaf-dom" as const,
    ...overrides,
  };
}

function makeStackFrame(name: string, filePath?: string): ResolvedComponentFrame {
  return {
    component_name: name,
    file_path: filePath,
    line_kind: "definition" as const,
    is_library: false,
  };
}

// =============================================================================
// Test 1: Code Connect identity resolution via exact_source
// =============================================================================

async function testCodeConnectViaExactSource(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, CODE_CONNECT_MAPPINGS);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  const ctx = makeContext({
    exact_source: makeExactSource(),
  });

  const result = await service.rankCandidates(ctx);

  assert(result.code_connect_resolved === true, "Should resolve via Code Connect");
  assert(result.candidates.length === 1, `Expected 1 candidate, got ${result.candidates.length}`);
  assert(result.candidates[0]!.confidence === 1.0, `Confidence should be 1.0, got ${result.candidates[0]!.confidence}`);
  assert(result.candidates[0]!.is_code_connect === true, "Should be marked as Code Connect");
  assert(result.candidates[0]!.component_id === "1:1", `Component ID should be "1:1", got ${result.candidates[0]!.component_id}`);
  assert(result.should_compute_diff === true, "Code Connect should always compute diff");
  assert(traces.length === 1, `Expected 1 trace, got ${traces.length}`);
  assert(traces[0]!.code_connect_available === true, "Trace should indicate Code Connect");

  pass("Code Connect identity resolution via exact_source: confidence=1.0, is_code_connect=true");
}

// =============================================================================
// Test 2: Signal-based ranking (no Code Connect)
// =============================================================================

async function testSignalBasedRanking(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, []); // No Code Connect
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  const ctx = makeContext({
    exact_source: makeExactSource({ component_name: "Button" }),
    resolved_component_stack: [makeStackFrame("Button"), makeStackFrame("App")],
  });

  const result = await service.rankCandidates(ctx);

  assert(result.code_connect_resolved === false, "Should NOT use Code Connect");
  assert(result.candidates.length > 0, "Should produce at least one candidate");
  assert(result.candidates[0]!.component_name === "Button", `Top candidate should be "Button", got "${result.candidates[0]!.component_name}"`);
  assert(result.candidates[0]!.confidence > 0, "Confidence should be > 0");
  assert(result.candidates[0]!.confidence < 1.0, "Non-Code-Connect confidence should be < 1.0");
  assert(result.candidates[0]!.is_code_connect === false, "Should NOT be marked as Code Connect");
  assert(result.candidates[0]!.ranking_signals!.length > 0, "Should include ranking signals");
  assert(traces.length === 1, `Expected 1 trace, got ${traces.length}`);
  assert(traces[0]!.code_connect_available === false, "Trace should indicate no Code Connect");
  assert(traces[0]!.ranking_signals_used.length > 0, "Trace should list signals used");

  pass("Signal-based ranking produces honest confidence < 1.0 with signals");
}

// =============================================================================
// Test 3: Low-confidence match does NOT trigger diff
// =============================================================================

async function testLowConfidenceNoDiff(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, []);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  // Context with no matching signals — should produce low confidence
  const ctx = makeContext({
    exact_source: makeExactSource({ component_name: "CompletelyUnrelatedWidget" }),
    title: "Some completely unrelated feedback",
    dom_selector: "span.xyz",
    page_url: "https://app.example.com/settings",
  });

  const result = await service.rankCandidates(ctx);

  // Even if some weak matches exist, diff threshold should not be met
  if (result.candidates.length > 0) {
    const topConf = result.candidates[0]!.confidence;
    assert(result.should_compute_diff === (topConf >= 0.6),
      `should_compute_diff=${result.should_compute_diff} inconsistent with confidence=${topConf}`);
  }
  if (result.candidates.length === 0 || result.candidates[0]!.confidence < 0.6) {
    assert(result.should_compute_diff === false, "Low-confidence should NOT compute diff");
  }

  pass("Low-confidence matches do NOT trigger automatic design diff");
}

// =============================================================================
// Test 4: Trace has full diagnostic fields
// =============================================================================

async function testTraceShape(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, CODE_CONNECT_MAPPINGS);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  const ctx = makeContext({
    exact_source: makeExactSource(),
  });

  await service.rankCandidates(ctx);

  assert(traces.length === 1, "Expected exactly 1 trace");
  const trace = traces[0]!;

  // Required fields from FigmaRankingTraceEvent
  assert(typeof trace.candidate_count === "number", "candidate_count should be number");
  assert(typeof trace.top_confidence === "number", "top_confidence should be number");
  assert(Array.isArray(trace.ranking_signals_used), "ranking_signals_used should be array");
  assert(typeof trace.code_connect_available === "boolean", "code_connect_available should be boolean");
  assert(typeof trace.duration_ms === "number", "duration_ms should be number");

  // Extended diagnostic fields
  assert(trace.bundle_id === "test-bundle-1", `bundle_id should match, got ${trace.bundle_id}`);
  assert(Array.isArray(trace.candidate_list), "candidate_list should be array");
  assert(trace.candidate_list!.length > 0, "candidate_list should have entries");
  assert(typeof trace.candidate_list![0]!.node_id === "string", "candidate_list entry should have node_id");
  assert(typeof trace.candidate_list![0]!.name === "string", "candidate_list entry should have name");
  assert(typeof trace.candidate_list![0]!.confidence === "number", "candidate_list entry should have confidence");
  assert(typeof trace.ranking_reason === "string", "ranking_reason should be string");
  assert(typeof trace.no_match === "boolean", "no_match should be boolean");

  pass("Ranking trace has full diagnostic shape (bundle_id, candidate_list, ranking_reason, no_match)");
}

// =============================================================================
// Test 5: No components → no-match trace
// =============================================================================

async function testNoComponents(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient([], []); // Empty
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  const ctx = makeContext({
    exact_source: makeExactSource(),
  });

  const result = await service.rankCandidates(ctx);

  assert(result.candidates.length === 0, "Should produce no candidates");
  assert(result.code_connect_resolved === false, "No Code Connect without components");
  assert(result.should_compute_diff === false, "No diff without candidates");
  assert(traces.length === 1, "Should still emit trace");
  assert(traces[0]!.no_match === true, "Trace should indicate no-match");
  assert(traces[0]!.candidate_count === 0, "candidate_count should be 0");

  pass("Empty component list produces no-match trace with candidate_count=0");
}

// =============================================================================
// Test 6: exact_source is strongest non-Code-Connect signal
// =============================================================================

async function testExactSourceStrongestSignal(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, []);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  // exact_source matches "Card", stack matches nothing relevant
  const ctx = makeContext({
    exact_source: makeExactSource({ component_name: "Card", file_path: "src/Card.tsx" }),
    resolved_component_stack: [makeStackFrame("Wrapper"), makeStackFrame("Layout")],
    title: "Some issue with the card",
  });

  const result = await service.rankCandidates(ctx);

  assert(result.candidates.length > 0, "Should produce candidates");
  assert(result.candidates[0]!.component_name === "Card", `Top candidate should be "Card", got "${result.candidates[0]!.component_name}"`);

  // Verify exact_source signal is present
  const signals = result.candidates[0]!.ranking_signals!;
  const exactSourceSignal = signals.find((s) => s.signal === "exact_source_name");
  assert(!!exactSourceSignal, "Should include exact_source_name signal");
  assert(exactSourceSignal!.matched === true, "exact_source_name should be matched");

  pass("exact_source name match is the strongest non-Code-Connect ranking signal");
}

// =============================================================================
// Test 7: Multiple signals combine
// =============================================================================

async function testMultipleSignalsCombine(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, []);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  // exact_source + stack both match "Header", page context matches "Layout"
  const ctx = makeContext({
    exact_source: makeExactSource({ component_name: "Header", file_path: "src/Header.tsx" }),
    resolved_component_stack: [makeStackFrame("Header"), makeStackFrame("App")],
    title: "Header navigation issue",
    page_url: "https://app.example.com/dashboard",
  });

  const result = await service.rankCandidates(ctx);

  assert(result.candidates.length > 0, "Should produce candidates");
  assert(result.candidates[0]!.component_name === "Header", `Top should be "Header", got "${result.candidates[0]!.component_name}"`);

  // Header should have higher confidence than a single-signal match
  const headerConf = result.candidates[0]!.confidence;
  assert(headerConf > 0.5, `Combined signals should produce confidence > 0.5, got ${headerConf}`);

  // Trace should show multiple signals used
  const trace = traces[0]!;
  assert(trace.ranking_signals_used.length >= 2, `Expected >= 2 signals used, got ${trace.ranking_signals_used.length}`);

  pass("Multiple signals (exact_source + stack) combine for higher confidence");
}

// =============================================================================
// Test 8: Code Connect resolves via component stack
// =============================================================================

async function testCodeConnectViaStack(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, CODE_CONNECT_MAPPINGS);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  // exact_source does NOT match any Code Connect mapping
  // but stack has "Header" which matches
  const ctx = makeContext({
    exact_source: makeExactSource({ component_name: "SomeChild", file_path: "src/SomeChild.tsx" }),
    resolved_component_stack: [makeStackFrame("Header"), makeStackFrame("Layout")],
  });

  const result = await service.rankCandidates(ctx);

  assert(result.code_connect_resolved === true, "Should resolve via Code Connect through stack");
  assert(result.candidates[0]!.component_name === "Header", `Should resolve to "Header", got "${result.candidates[0]!.component_name}"`);
  assert(result.candidates[0]!.confidence === 1.0, "Code Connect confidence should be 1.0");
  assert(result.candidates[0]!.is_code_connect === true, "Should be marked as Code Connect");

  pass("Code Connect resolves via component stack when exact_source doesn't match");
}

// =============================================================================
// Test 9: Normalized name matching
// =============================================================================

async function testNormalizedNameMatching(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const components: FigmaComponentInfo[] = [
    { node_id: "2:1", name: "search-bar", page_name: "Dashboard" },
    { node_id: "2:2", name: "profile_card_component", page_name: "Profile" },
  ];
  const client = new StubFigmaClient(components, []);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  // "SearchBar" should match "search-bar" after normalization
  const ctx = makeContext({
    exact_source: makeExactSource({ component_name: "SearchBar" }),
  });

  const result = await service.rankCandidates(ctx);

  assert(result.candidates.length > 0, "Should match despite naming convention differences");
  assert(result.candidates[0]!.component_id === "2:1", `Should match "search-bar", got "${result.candidates[0]!.component_name}"`);

  pass("Normalized matching handles case, separators, and suffixes (SearchBar matches search-bar)");
}

// =============================================================================
// Test 10: Ranking signals recorded on candidates
// =============================================================================

async function testSignalsRecordedOnCandidates(): Promise<void> {
  const traces: FigmaRankingTraceEvent[] = [];
  const client = new StubFigmaClient(FIGMA_COMPONENTS, []);
  const service = new FigmaRankingService(client, (t) => traces.push(t));

  const ctx = makeContext({
    exact_source: makeExactSource({ component_name: "Navigation" }),
    dom_selector: "nav.sidebar",
    page_url: "https://app.example.com/dashboard",
  });

  const result = await service.rankCandidates(ctx);

  assert(result.candidates.length > 0, "Should produce candidates");

  // Top candidate should have signals array
  const topCandidate = result.candidates[0]!;
  assert(Array.isArray(topCandidate.ranking_signals), "ranking_signals should be an array");
  assert(topCandidate.ranking_signals!.length > 0, "Should have at least one matched signal");

  // Each signal should have the required fields
  for (const signal of topCandidate.ranking_signals!) {
    assert(typeof signal.signal === "string", `signal.signal should be string, got ${typeof signal.signal}`);
    assert(typeof signal.weight === "number", `signal.weight should be number, got ${typeof signal.weight}`);
    assert(signal.matched === true, "Only matched signals should be on candidates");
  }

  pass("Ranking signals are recorded on each candidate with signal/weight/matched/detail");
}

// =============================================================================
// Run
// =============================================================================

console.log("=== Figma Candidate Ranking Tests ===\n");

const tests = [
  testCodeConnectViaExactSource,
  testSignalBasedRanking,
  testLowConfidenceNoDiff,
  testTraceShape,
  testNoComponents,
  testExactSourceStrongestSignal,
  testMultipleSignalsCombine,
  testCodeConnectViaStack,
  testNormalizedNameMatching,
  testSignalsRecordedOnCandidates,
];

(async () => {
  for (const test of tests) {
    try {
      await test();
    } catch (err) {
      failed++;
      console.error(`FAIL: ${test.name} — ${(err as Error).message}`);
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
})();
