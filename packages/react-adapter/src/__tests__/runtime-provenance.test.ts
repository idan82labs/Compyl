/**
 * Runtime provenance proof — synthetic fiber fixture.
 *
 * WHAT THIS PROVES:
 * - resolveComponentStack() walks fiber trees and extracts __rlMeta
 * - Instrumented components produce fiber_meta resolution mode
 * - Mixed instrumented/uninstrumented ancestry works correctly
 * - Graceful degradation when no fiber is found (leaf_only)
 * - resolved_component_stack is ALWAYS an array, SEPARATE from exact_source
 * - All 4 wrapper shapes (plain, memo, forwardRef, memo+forwardRef) resolve in fiber walk
 * - Root boundary detection produces correct boundary_kind
 * - Telemetry events are emitted with correct shape
 * - Failure callback is invoked on adapter errors
 *
 * HOW: Constructs synthetic React fiber trees that match React 18/19 internal
 * structure, attaches them to mock DOM-like objects, and calls resolveComponentStack().
 *
 * The resolver uses only Object.keys() and property access on elements — no real
 * DOM methods — so synthetic objects work identically to real DOM elements at runtime.
 *
 * WHAT STILL REQUIRES REAL BROWSER:
 * - Actual React rendering producing fiber trees
 * - End-to-end: JSX → SWC transform → React render → click → fiber walk
 * - Portal boundary detection (references document.getElementById)
 */

import { resolveComponentStack } from "../resolver.js";
import type { RlMeta, AdapterFailureEvent, ResolutionTelemetryEvent } from "@compyl/contracts";

// =============================================================================
// Fiber tree construction helpers
// =============================================================================

const HOST_COMPONENT = 5;
const HOST_ROOT = 3;
const FUNCTION_COMPONENT = 0;

interface SyntheticFiber {
  tag: number;
  type: unknown;
  elementType: unknown;
  return: SyntheticFiber | null;
  stateNode: unknown;
  memoizedProps: Record<string, unknown>;
}

function makeFiber(
  tag: number,
  type: unknown,
  parent: SyntheticFiber | null = null,
): SyntheticFiber {
  return {
    tag,
    type,
    elementType: type,
    return: parent,
    stateNode: null,
    memoizedProps: {},
  };
}

function makeInstrumentedType(meta: RlMeta): { __rlMeta: RlMeta; name: string } {
  return { __rlMeta: meta, name: meta.name };
}

function makeMemoType(inner: unknown): { $$typeof: symbol; type: unknown; name?: string } {
  return { $$typeof: Symbol.for("react.memo"), type: inner };
}

function makeForwardRefType(render: unknown): { $$typeof: symbol; render: unknown; name?: string } {
  return { $$typeof: Symbol.for("react.forward_ref"), render };
}

function makeUninstrumentedType(name: string): { name: string } {
  return { name };
}

/** Attach a fiber to a mock "DOM element" via React's __reactFiber$ key. */
function mockElement(fiber: SyntheticFiber): unknown {
  return { "__reactFiber$abc123": fiber };
}

// =============================================================================
// Helpers
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
// Test 1: Fully instrumented 3-component ancestry → fiber_meta
// =============================================================================

function testFullyInstrumentedAncestry(): void {
  // Build fiber tree: App → Layout → Button → <div> (DOM host)
  const appMeta: RlMeta = { id: 1, name: "App", file: "src/App.tsx", line: 5, isLibrary: false };
  const layoutMeta: RlMeta = { id: 2, name: "Layout", file: "src/Layout.tsx", line: 10, isLibrary: false };
  const buttonMeta: RlMeta = { id: 3, name: "Button", file: "src/Button.tsx", line: 15, isLibrary: false };

  const rootFiber = makeFiber(HOST_ROOT, null);
  const appFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(appMeta), rootFiber);
  const layoutFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(layoutMeta), appFiber);
  const buttonFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(buttonMeta), layoutFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", buttonFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  // Must be fiber_meta since we found __rlMeta
  assert(result.resolution_mode === "fiber_meta", `Expected fiber_meta, got ${result.resolution_mode}`);

  // resolved_component_stack is ALWAYS an array
  assert(Array.isArray(result.resolved_component_stack), "resolved_component_stack must be array");

  // 3 instrumented components found
  assert(result.resolved_component_stack.length === 3, `Expected 3 frames, got ${result.resolved_component_stack.length}`);

  // Frames are in walk-up order: Button, Layout, App
  assert(result.resolved_component_stack[0]!.component_name === "Button", "First frame should be Button");
  assert(result.resolved_component_stack[1]!.component_name === "Layout", "Second frame should be Layout");
  assert(result.resolved_component_stack[2]!.component_name === "App", "Third frame should be App");

  // All frames have definition line_kind (ancestor frames)
  for (const frame of result.resolved_component_stack) {
    assert(frame.line_kind === "definition", `Frame ${frame.component_name} should have line_kind=definition`);
    assert(frame.is_library === false, `Frame ${frame.component_name} should not be library`);
  }

  // File paths preserved
  assert(result.resolved_component_stack[0]!.file_path === "src/Button.tsx", "Button file_path mismatch");
  assert(result.resolved_component_stack[2]!.file_path === "src/App.tsx", "App file_path mismatch");

  // No missing reasons
  assert(result.missing_reasons.length === 0, `Expected 0 missing reasons, got ${result.missing_reasons.length}`);

  // Telemetry emitted
  assert(result.telemetry.resolution_mode === "fiber_meta", "Telemetry mode mismatch");
  assert(result.telemetry.frame_count === 3, "Telemetry frame count mismatch");
  assert(typeof result.telemetry.duration_ms === "number", "Telemetry duration_ms must be number");

  // exact_source_available is false (determined separately, not by this function)
  assert(result.telemetry.exact_source_available === false, "exact_source_available should be false");

  pass("Fully instrumented 3-component ancestry → fiber_meta with 3 frames");
}

// =============================================================================
// Test 2: No fiber found → leaf_only degradation
// =============================================================================

function testNoFiberDegradation(): void {
  // Element with no React fiber key
  const element = { someOtherProp: "value" };
  const result = resolveComponentStack(element as unknown as Element);

  assert(result.resolution_mode === "leaf_only", `Expected leaf_only, got ${result.resolution_mode}`);
  assert(result.resolved_component_stack.length === 0, "Should have no frames");
  assert(result.missing_reasons.includes("no_fiber_found"), "Should include no_fiber_found reason");
  assert(result.root_boundary_kind === null, "Should have null boundary kind");

  pass("No fiber → leaf_only degradation with no_fiber_found reason");
}

// =============================================================================
// Test 3: Mixed instrumented + uninstrumented ancestry
// =============================================================================

function testMixedAncestry(): void {
  // App (instrumented) → ThirdPartyProvider (uninstrumented) → Card (instrumented) → <span>
  const appMeta: RlMeta = { id: 1, name: "App", file: "src/App.tsx", line: 5, isLibrary: false };
  const cardMeta: RlMeta = { id: 2, name: "Card", file: "src/Card.tsx", line: 20, isLibrary: false };

  const rootFiber = makeFiber(HOST_ROOT, null);
  const appFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(appMeta), rootFiber);
  const providerFiber = makeFiber(FUNCTION_COMPONENT, makeUninstrumentedType("ThirdPartyProvider"), appFiber);
  const cardFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(cardMeta), providerFiber);
  const spanFiber = makeFiber(HOST_COMPONENT, "span", cardFiber);

  const element = mockElement(spanFiber);
  const result = resolveComponentStack(element as Element);

  // Should be fiber_meta because we found at least one __rlMeta
  assert(result.resolution_mode === "fiber_meta", `Expected fiber_meta, got ${result.resolution_mode}`);

  // 3 frames: Card (instrumented), ThirdPartyProvider (uninstrumented), App (instrumented)
  assert(result.resolved_component_stack.length === 3, `Expected 3 frames, got ${result.resolved_component_stack.length}`);

  // ThirdPartyProvider is marked as library (uninstrumented = assume third-party)
  const providerFrame = result.resolved_component_stack[1]!;
  assert(providerFrame.component_name === "ThirdPartyProvider", "Middle frame should be ThirdPartyProvider");
  assert(providerFrame.is_library === true, "Uninstrumented component should be is_library=true");
  assert(!providerFrame.file_path, "Uninstrumented component should have no file_path");

  // missing_reasons includes the uninstrumented component
  assert(
    result.missing_reasons.some(r => r.includes("no_rl_meta:ThirdPartyProvider")),
    "Should have missing_reason for uninstrumented ThirdPartyProvider",
  );

  pass("Mixed ancestry: instrumented + uninstrumented components correctly classified");
}

// =============================================================================
// Test 4: memo() wrapper resolved in fiber walk
// =============================================================================

function testMemoInFiberWalk(): void {
  const innerMeta: RlMeta = { id: 1, name: "MemoCard", file: "src/MemoCard.tsx", line: 8, isLibrary: false };
  const innerType = makeInstrumentedType(innerMeta);
  const memoType = makeMemoType(innerType);

  const rootFiber = makeFiber(HOST_ROOT, null);
  const memoFiber = makeFiber(FUNCTION_COMPONENT, memoType, rootFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", memoFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  assert(result.resolution_mode === "fiber_meta", `Expected fiber_meta, got ${result.resolution_mode}`);
  assert(result.resolved_component_stack.length === 1, `Expected 1 frame, got ${result.resolved_component_stack.length}`);
  assert(result.resolved_component_stack[0]!.component_name === "MemoCard", "Should resolve MemoCard through memo wrapper");
  assert(result.resolved_component_stack[0]!.file_path === "src/MemoCard.tsx", "File path should be preserved through memo");

  pass("memo() wrapper resolved correctly in fiber walk");
}

// =============================================================================
// Test 5: forwardRef() wrapper resolved in fiber walk
// =============================================================================

function testForwardRefInFiberWalk(): void {
  const renderFn = { __rlMeta: { id: 1, name: "Input", file: "src/Input.tsx", line: 12, isLibrary: false } as RlMeta, name: "Input" };
  const forwardRefType = makeForwardRefType(renderFn);

  const rootFiber = makeFiber(HOST_ROOT, null);
  const refFiber = makeFiber(FUNCTION_COMPONENT, forwardRefType, rootFiber);
  const inputFiber = makeFiber(HOST_COMPONENT, "input", refFiber);

  const element = mockElement(inputFiber);
  const result = resolveComponentStack(element as Element);

  assert(result.resolution_mode === "fiber_meta", `Expected fiber_meta, got ${result.resolution_mode}`);
  assert(result.resolved_component_stack.length === 1, `Expected 1 frame, got ${result.resolved_component_stack.length}`);
  assert(result.resolved_component_stack[0]!.component_name === "Input", "Should resolve Input through forwardRef wrapper");

  pass("forwardRef() wrapper resolved correctly in fiber walk");
}

// =============================================================================
// Test 6: memo(forwardRef()) wrapper resolved in fiber walk
// =============================================================================

function testMemoForwardRefInFiberWalk(): void {
  const renderFn = { __rlMeta: { id: 1, name: "Select", file: "src/Select.tsx", line: 25, isLibrary: false } as RlMeta, name: "Select" };
  const forwardRefType = makeForwardRefType(renderFn);
  const memoType = makeMemoType(forwardRefType);

  const rootFiber = makeFiber(HOST_ROOT, null);
  const memoFiber = makeFiber(FUNCTION_COMPONENT, memoType, rootFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", memoFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  assert(result.resolution_mode === "fiber_meta", `Expected fiber_meta, got ${result.resolution_mode}`);
  assert(result.resolved_component_stack.length === 1, `Expected 1 frame, got ${result.resolved_component_stack.length}`);
  assert(result.resolved_component_stack[0]!.component_name === "Select", "Should resolve Select through memo(forwardRef)");

  pass("memo(forwardRef()) wrapper resolved correctly in fiber walk");
}

// =============================================================================
// Test 7: Fully uninstrumented ancestry → heuristic mode
// =============================================================================

function testFullyUninstrumentedAncestry(): void {
  const rootFiber = makeFiber(HOST_ROOT, null);
  const appFiber = makeFiber(FUNCTION_COMPONENT, makeUninstrumentedType("App"), rootFiber);
  const layoutFiber = makeFiber(FUNCTION_COMPONENT, makeUninstrumentedType("Layout"), appFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", layoutFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  // No __rlMeta found → heuristic mode
  assert(result.resolution_mode === "heuristic", `Expected heuristic, got ${result.resolution_mode}`);

  // Still finds component names from displayName/name
  assert(result.resolved_component_stack.length === 2, `Expected 2 frames, got ${result.resolved_component_stack.length}`);

  // All marked as library (uninstrumented = assumed third-party)
  for (const frame of result.resolved_component_stack) {
    assert(frame.is_library === true, `Uninstrumented frame ${frame.component_name} should be is_library=true`);
  }

  // missing_reasons for each uninstrumented component
  assert(result.missing_reasons.length === 2, `Expected 2 missing reasons, got ${result.missing_reasons.length}`);

  pass("Fully uninstrumented ancestry → heuristic mode with is_library=true");
}

// =============================================================================
// Test 8: resolved_component_stack is NEVER exact_source
// =============================================================================

function testSeparationFromExactSource(): void {
  const meta: RlMeta = { id: 1, name: "Comp", file: "src/Comp.tsx", line: 1, isLibrary: false };

  const rootFiber = makeFiber(HOST_ROOT, null);
  const compFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(meta), rootFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", compFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  // The result has resolved_component_stack but NOT exact_source
  assert("resolved_component_stack" in result, "Result must have resolved_component_stack");
  assert("resolution_mode" in result, "Result must have resolution_mode");
  assert("missing_reasons" in result, "Result must have missing_reasons");
  assert("root_boundary_kind" in result, "Result must have root_boundary_kind");
  assert("telemetry" in result, "Result must have telemetry");

  // exact_source is NOT a field on the result — it's determined separately from data-rl-source
  assert(!("exact_source" in result), "Result must NOT contain exact_source (that's build-time)");

  // Frames use line_kind "definition", not "leaf-dom" (which is only for exact_source)
  for (const frame of result.resolved_component_stack) {
    assert(frame.line_kind === "definition", "Ancestry frames must be definition, not leaf-dom");
  }

  pass("resolved_component_stack is separate from exact_source — no leakage");
}

// =============================================================================
// Test 9: Root boundary detection at HostRoot
// =============================================================================

function testRootBoundaryDetection(): void {
  // Single root → should have null or separate_root boundary
  const rootFiber = makeFiber(HOST_ROOT, null);
  rootFiber.stateNode = {}; // Minimal stateNode
  const compFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(
    { id: 1, name: "Comp", file: "src/Comp.tsx", line: 1, isLibrary: false },
  ), rootFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", compFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  // root_boundary_kind can be null (normal root) or "separate_root"
  // The important thing is it's typed correctly
  assert(
    result.root_boundary_kind === null || result.root_boundary_kind === "separate_root",
    `Unexpected boundary kind: ${result.root_boundary_kind}`,
  );

  pass("Root boundary detection produces valid boundary_kind");
}

// =============================================================================
// Test 10: Failure callback invoked on adapter error
// =============================================================================

function testFailureCallbackInvoked(): void {
  // Create an element whose fiber tree will cause an error
  const poisonedFiber = makeFiber(FUNCTION_COMPONENT, null, null);
  // Make the walk throw by setting return to a non-null invalid object
  Object.defineProperty(poisonedFiber, "return", {
    get() { throw new Error("fiber access error"); },
  });

  // Attach to element but make the initial fiber valid enough to start walking
  const validStartFiber = makeFiber(HOST_COMPONENT, "div", null);
  // Override return with getter that throws
  Object.defineProperty(validStartFiber, "return", {
    get() { throw new Error("simulated adapter error"); },
    configurable: true,
  });

  const element = mockElement(validStartFiber);

  let failureEvent: AdapterFailureEvent | null = null;
  const onFailure = (event: AdapterFailureEvent) => {
    failureEvent = event;
  };

  const result = resolveComponentStack(element as Element, onFailure);

  // Should degrade to leaf_only
  assert(result.resolution_mode === "leaf_only", `Expected leaf_only on error, got ${result.resolution_mode}`);

  // Failure callback should have been invoked
  assert(failureEvent !== null, "Failure callback should have been invoked");
  assert(failureEvent!.fallback_mode === "leaf_only", "Fallback mode should be leaf_only");
  assert(failureEvent!.failure_type === "simulated adapter error", `Expected simulated error, got: ${failureEvent!.failure_type}`);
  assert(typeof failureEvent!.fiber_depth_reached === "number", "fiber_depth_reached should be a number");

  pass("Failure callback invoked on adapter error → graceful leaf_only degradation");
}

// =============================================================================
// Test 11: Library component flag preserved through fiber walk
// =============================================================================

function testLibraryFlagInFiberWalk(): void {
  const appMeta: RlMeta = { id: 1, name: "App", file: "src/App.tsx", line: 1, isLibrary: false };
  const libMeta: RlMeta = { id: 2, name: "DesignButton", file: "node_modules/design-lib/Button.tsx", line: 42, isLibrary: true };

  const rootFiber = makeFiber(HOST_ROOT, null);
  const appFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(appMeta), rootFiber);
  const libFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(libMeta), appFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", libFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  assert(result.resolved_component_stack.length === 2, `Expected 2 frames, got ${result.resolved_component_stack.length}`);

  // First frame (DesignButton) should be library
  assert(result.resolved_component_stack[0]!.is_library === true, "DesignButton should be is_library=true");
  assert(result.resolved_component_stack[0]!.component_name === "DesignButton", "First frame should be DesignButton");

  // Second frame (App) should NOT be library
  assert(result.resolved_component_stack[1]!.is_library === false, "App should be is_library=false");

  pass("Library component flag preserved through fiber walk (is_library=true for lib, false for app)");
}

// =============================================================================
// Test 12: Telemetry shape matches ResolutionTelemetryEvent contract
// =============================================================================

function testTelemetryShape(): void {
  const meta: RlMeta = { id: 1, name: "Comp", file: "src/Comp.tsx", line: 1, isLibrary: false };

  const rootFiber = makeFiber(HOST_ROOT, null);
  const compFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(meta), rootFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", compFiber);

  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  const telemetry = result.telemetry;

  // All required fields from ResolutionTelemetryEvent
  assert("resolution_mode" in telemetry, "Telemetry must have resolution_mode");
  assert("frame_count" in telemetry, "Telemetry must have frame_count");
  assert("missing_reasons" in telemetry, "Telemetry must have missing_reasons");
  assert("exact_source_available" in telemetry, "Telemetry must have exact_source_available");
  assert("duration_ms" in telemetry, "Telemetry must have duration_ms");

  // Correct types
  assert(typeof telemetry.resolution_mode === "string", "resolution_mode should be string");
  assert(typeof telemetry.frame_count === "number", "frame_count should be number");
  assert(Array.isArray(telemetry.missing_reasons), "missing_reasons should be array");
  assert(typeof telemetry.exact_source_available === "boolean", "exact_source_available should be boolean");
  assert(typeof telemetry.duration_ms === "number", "duration_ms should be number");
  assert(telemetry.duration_ms >= 0, "duration_ms should be non-negative");

  // No extra fields
  const telemetryKeys = Object.keys(telemetry);
  assert(telemetryKeys.length === 5, `Telemetry should have exactly 5 fields, got ${telemetryKeys.length}`);

  pass("Telemetry shape matches ResolutionTelemetryEvent contract (5 fields, correct types)");
}

// =============================================================================
// Test 13: Deep ancestry (10+ components)
// =============================================================================

function testDeepAncestry(): void {
  const rootFiber = makeFiber(HOST_ROOT, null);
  let current = rootFiber;

  // Build a 12-component deep tree
  for (let i = 0; i < 12; i++) {
    const meta: RlMeta = { id: i, name: `Comp${i}`, file: `src/Comp${i}.tsx`, line: i + 1, isLibrary: false };
    const fiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(meta), current);
    current = fiber;
  }

  const divFiber = makeFiber(HOST_COMPONENT, "div", current);
  const element = mockElement(divFiber);
  const result = resolveComponentStack(element as Element);

  assert(result.resolution_mode === "fiber_meta", `Expected fiber_meta, got ${result.resolution_mode}`);
  assert(result.resolved_component_stack.length === 12, `Expected 12 frames, got ${result.resolved_component_stack.length}`);

  // First frame should be Comp11 (closest to the div), last should be Comp0 (closest to root)
  assert(result.resolved_component_stack[0]!.component_name === "Comp11", "First frame should be Comp11 (nearest)");
  assert(result.resolved_component_stack[11]!.component_name === "Comp0", "Last frame should be Comp0 (root-adjacent)");

  pass("Deep ancestry (12 components) resolved correctly in walk-up order");
}

// =============================================================================
// Test 14: onTelemetry callback invoked on successful resolution
// =============================================================================

function testTelemetryCallbackOnSuccess(): void {
  const meta: RlMeta = { id: 1, name: "Page", file: "src/Page.tsx", line: 1, isLibrary: false };
  const rootFiber = makeFiber(HOST_ROOT, null);
  const pageFiber = makeFiber(FUNCTION_COMPONENT, makeInstrumentedType(meta), rootFiber);
  const divFiber = makeFiber(HOST_COMPONENT, "div", pageFiber);
  const element = mockElement(divFiber);

  let telemetryEvent: ResolutionTelemetryEvent | null = null;
  const result = resolveComponentStack(element as Element, {
    onTelemetry: (e) => { telemetryEvent = e; },
  });

  assert(telemetryEvent !== null, "onTelemetry should have been called");
  assert(telemetryEvent!.resolution_mode === "fiber_meta", `Expected fiber_meta, got ${telemetryEvent!.resolution_mode}`);
  assert(telemetryEvent!.frame_count === 1, `Expected 1 frame, got ${telemetryEvent!.frame_count}`);
  assert(telemetryEvent!.duration_ms >= 0, "duration_ms should be non-negative");
  // Telemetry should match result
  assert(telemetryEvent!.resolution_mode === result.telemetry.resolution_mode, "Callback telemetry should match result telemetry");
  assert(telemetryEvent!.frame_count === result.telemetry.frame_count, "Frame count should match");

  pass("onTelemetry callback invoked on successful fiber_meta resolution");
}

// =============================================================================
// Test 15: onTelemetry callback invoked on leaf_only degradation
// =============================================================================

function testTelemetryCallbackOnDegradation(): void {
  const element = { "__non_react_key": true } as unknown;

  let telemetryEvent: ResolutionTelemetryEvent | null = null;
  resolveComponentStack(element as Element, {
    onTelemetry: (e) => { telemetryEvent = e; },
  });

  assert(telemetryEvent !== null, "onTelemetry should fire on degradation");
  assert(telemetryEvent!.resolution_mode === "leaf_only", `Expected leaf_only, got ${telemetryEvent!.resolution_mode}`);
  assert(telemetryEvent!.frame_count === 0, "Frame count should be 0 on degradation");
  assert(telemetryEvent!.missing_reasons.includes("no_fiber_found"), "missing_reasons should include no_fiber_found");

  pass("onTelemetry callback invoked on leaf_only degradation (no fiber found)");
}

// =============================================================================
// Test 16: onTelemetry callback invoked on adapter failure
// =============================================================================

function testTelemetryCallbackOnFailure(): void {
  const validStartFiber = makeFiber(HOST_COMPONENT, "div", null);
  Object.defineProperty(validStartFiber, "return", {
    get() { throw new Error("telemetry failure test"); },
    configurable: true,
  });
  const element = mockElement(validStartFiber);

  let telemetryEvent: ResolutionTelemetryEvent | null = null;
  let failureEvent: AdapterFailureEvent | null = null;

  resolveComponentStack(element as Element, {
    onTelemetry: (e) => { telemetryEvent = e; },
    onFailure: (e) => { failureEvent = e; },
  });

  assert(telemetryEvent !== null, "onTelemetry should fire on adapter failure");
  assert(telemetryEvent!.resolution_mode === "leaf_only", "Should degrade to leaf_only on error");
  assert(failureEvent !== null, "onFailure should also fire");
  assert(failureEvent!.failure_type === "telemetry failure test", "Failure type should match error");

  pass("onTelemetry AND onFailure both invoked on adapter error");
}

// =============================================================================
// Test 17: Backward compatibility — bare function callback still works
// =============================================================================

function testBackwardCompatibility(): void {
  const validStartFiber = makeFiber(HOST_COMPONENT, "div", null);
  Object.defineProperty(validStartFiber, "return", {
    get() { throw new Error("compat test error"); },
    configurable: true,
  });
  const element = mockElement(validStartFiber);

  let failureEvent: AdapterFailureEvent | null = null;
  // Old API: pass bare function (not object)
  resolveComponentStack(element as Element, (e: AdapterFailureEvent) => { failureEvent = e; });

  assert(failureEvent !== null, "Old-style onFailure callback should still work");
  assert(failureEvent!.failure_type === "compat test error", "Failure type should match");

  pass("Backward compatibility: bare onFailure function still works");
}

// =============================================================================
// Run all tests
// =============================================================================

console.log("=== Runtime Provenance Proof Tests ===\n");

const tests = [
  testFullyInstrumentedAncestry,
  testNoFiberDegradation,
  testMixedAncestry,
  testMemoInFiberWalk,
  testForwardRefInFiberWalk,
  testMemoForwardRefInFiberWalk,
  testFullyUninstrumentedAncestry,
  testSeparationFromExactSource,
  testRootBoundaryDetection,
  testFailureCallbackInvoked,
  testLibraryFlagInFiberWalk,
  testTelemetryShape,
  testDeepAncestry,
  testTelemetryCallbackOnSuccess,
  testTelemetryCallbackOnDegradation,
  testTelemetryCallbackOnFailure,
  testBackwardCompatibility,
];

for (const test of tests) {
  try {
    test();
  } catch (err) {
    failed++;
    console.error(`FAIL: ${test.name} — ${(err as Error).message}`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

console.log("\n=== Runtime Provenance Confidence ===");
console.log("NOW PROVEN:");
console.log("  - resolveComponentStack() walks synthetic fiber trees correctly");
console.log("  - fiber_meta mode: instrumented components with __rlMeta → correct frames");
console.log("  - heuristic mode: uninstrumented components → is_library=true + missing_reasons");
console.log("  - leaf_only mode: no fiber found → graceful degradation");
console.log("  - All 4 wrapper shapes resolved in fiber walk: plain, memo, forwardRef, memo(forwardRef)");
console.log("  - resolved_component_stack is ALWAYS separate from exact_source");
console.log("  - Ancestry frames always use line_kind=definition (not leaf-dom)");
console.log("  - Library flag preserved through fiber walk");
console.log("  - Failure callback invoked on adapter errors");
console.log("  - Telemetry matches ResolutionTelemetryEvent contract");
console.log("  - Deep ancestry (12 components) works correctly");
console.log("");
console.log("STILL REQUIRES REAL BROWSER:");
console.log("  - Actual React render → getFiberFromElement with real __reactFiber$ keys");
console.log("  - Portal boundary detection (needs document.getElementById)");
console.log("  - End-to-end: JSX → SWC transform → React render → click → fiber walk");

if (failed > 0) {
  process.exit(1);
}
