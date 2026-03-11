/**
 * Build plugin scaffold tests.
 *
 * WHAT THESE TESTS PROVE:
 * - Source marker encoding/parsing produces correct data-rl-source values
 * - Metadata attachment works on plain components, memo, forwardRef, memo(forwardRef)
 * - File inclusion/exclusion logic is correct
 * - Relative path computation strips root directory
 * - Plugin NEVER emits data-rl-stack or full ancestry
 * - Transform plan produces only the two legal artifact types
 *
 * WHAT THESE TESTS CANNOT PROVE (requires integration):
 * - Real SWC/Babel AST transformation
 * - Integration with Next.js/Vite/webpack build pipeline
 * - Production stripping behavior in a real build
 * - react-adapter can actually read the emitted __rlMeta at runtime
 */

import {
  encodeSourceMarker,
  parseSourceMarker,
  createRlMeta,
  attachRlMeta,
  attachRlMetaToWrapped,
  computeRelativePath,
  shouldInstrument,
  normalizeOptions,
  planFileTransforms,
} from "../index.js";
import type { RlMeta } from "@compyl/contracts";

// =============================================================================
// Test 1: Source marker encoding
// =============================================================================

function testSourceMarkerEncoding(): void {
  const marker = encodeSourceMarker("Button", "src/components/Button.tsx", 42);

  if (marker !== "Button|src/components/Button.tsx|42") {
    throw new Error(`Marker encoding wrong: ${marker}`);
  }

  // Verify format matches what backend expects for ExactSource construction
  const parts = marker.split("|");
  if (parts.length !== 3) {
    throw new Error(`Marker should have exactly 3 pipe-delimited parts, got ${parts.length}`);
  }

  console.log("PASS: Source marker encoding produces ComponentName|path|line format");
}

// =============================================================================
// Test 2: Source marker parsing (round-trip)
// =============================================================================

function testSourceMarkerParsing(): void {
  const original = { componentName: "Card", filePath: "src/ui/Card.tsx", line: 15 };
  const encoded = encodeSourceMarker(original.componentName, original.filePath, original.line);
  const parsed = parseSourceMarker(encoded);

  if (!parsed) {
    throw new Error("parseSourceMarker returned null for valid marker");
  }

  if (parsed.componentName !== original.componentName) {
    throw new Error(`componentName mismatch: ${parsed.componentName} !== ${original.componentName}`);
  }
  if (parsed.filePath !== original.filePath) {
    throw new Error(`filePath mismatch: ${parsed.filePath} !== ${original.filePath}`);
  }
  if (parsed.line !== original.line) {
    throw new Error(`line mismatch: ${parsed.line} !== ${original.line}`);
  }

  // Invalid markers
  if (parseSourceMarker("invalid") !== null) {
    throw new Error("Should return null for single-part marker");
  }
  if (parseSourceMarker("a|b") !== null) {
    throw new Error("Should return null for two-part marker");
  }
  if (parseSourceMarker("a|b|notanumber") !== null) {
    throw new Error("Should return null for non-numeric line");
  }

  console.log("PASS: Source marker round-trips correctly, rejects invalid formats");
}

// =============================================================================
// Test 3: RlMeta creation and attachment
// =============================================================================

function testRlMetaCreation(): void {
  const meta = createRlMeta(1, "Button", "src/Button.tsx", 5, false);

  if (meta.id !== 1) throw new Error(`id wrong: ${meta.id}`);
  if (meta.name !== "Button") throw new Error(`name wrong: ${meta.name}`);
  if (meta.file !== "src/Button.tsx") throw new Error(`file wrong: ${meta.file}`);
  if (meta.line !== 5) throw new Error(`line wrong: ${meta.line}`);
  if (meta.isLibrary !== false) throw new Error(`isLibrary wrong: ${meta.isLibrary}`);

  // Library component
  const libMeta = createRlMeta(2, "DesignButton", "lib/Button.tsx", 10, true);
  if (libMeta.isLibrary !== true) throw new Error("Library meta should have isLibrary=true");

  console.log("PASS: RlMeta creation produces correct shape");
}

function testRlMetaAttachment(): void {
  const component: { __rlMeta?: RlMeta; (): void } = Object.assign(
    function MyComponent() {},
    {} as { __rlMeta?: RlMeta },
  );
  const meta = createRlMeta(1, "MyComponent", "src/MyComponent.tsx", 3, false);

  attachRlMeta(component, meta);

  if (!component.__rlMeta) {
    throw new Error("__rlMeta not attached");
  }
  if (component.__rlMeta.name !== "MyComponent") {
    throw new Error(`Attached meta name wrong: ${component.__rlMeta.name}`);
  }

  console.log("PASS: attachRlMeta sets __rlMeta on component");
}

// =============================================================================
// Test 4: Wrapper-aware metadata attachment (memo, forwardRef)
// =============================================================================

function testMemoAttachment(): void {
  // Simulate React.memo() wrapper shape
  const innerComponent: Record<string, unknown> = {};
  const memoWrapper: Record<string, unknown> = {
    $$typeof: Symbol.for("react.memo"),
    type: innerComponent,
  };

  const meta = createRlMeta(1, "MemoCard", "src/Card.tsx", 10, false);
  attachRlMetaToWrapped(memoWrapper, meta);

  // Should attach to .type (the inner component)
  if ((innerComponent as { __rlMeta?: RlMeta }).__rlMeta?.name !== "MemoCard") {
    throw new Error("memo: __rlMeta not attached to .type");
  }

  // The wrapper itself should NOT have __rlMeta
  if ("__rlMeta" in memoWrapper) {
    throw new Error("memo: __rlMeta should be on .type, not on wrapper");
  }

  console.log("PASS: memo() wrapper — metadata attached to .type");
}

function testForwardRefAttachment(): void {
  // Simulate React.forwardRef() wrapper shape
  const renderFn: Record<string, unknown> = {};
  const forwardRefWrapper: Record<string, unknown> = {
    $$typeof: Symbol.for("react.forward_ref"),
    render: renderFn,
  };

  const meta = createRlMeta(2, "ForwardInput", "src/Input.tsx", 20, false);
  attachRlMetaToWrapped(forwardRefWrapper, meta);

  // Should attach to .render
  if ((renderFn as { __rlMeta?: RlMeta }).__rlMeta?.name !== "ForwardInput") {
    throw new Error("forwardRef: __rlMeta not attached to .render");
  }

  if ("__rlMeta" in forwardRefWrapper) {
    throw new Error("forwardRef: __rlMeta should be on .render, not on wrapper");
  }

  console.log("PASS: forwardRef() wrapper — metadata attached to .render");
}

function testMemoForwardRefAttachment(): void {
  // Simulate memo(forwardRef()) — nested wrapper
  const renderFn: Record<string, unknown> = {};
  const forwardRefInner: Record<string, unknown> = {
    $$typeof: Symbol.for("react.forward_ref"),
    render: renderFn,
  };
  const memoOuter: Record<string, unknown> = {
    $$typeof: Symbol.for("react.memo"),
    type: forwardRefInner,
  };

  const meta = createRlMeta(3, "MemoForwardSelect", "src/Select.tsx", 30, false);
  attachRlMetaToWrapped(memoOuter, meta);

  // Should attach to .type.render (the innermost function)
  if ((renderFn as { __rlMeta?: RlMeta }).__rlMeta?.name !== "MemoForwardSelect") {
    throw new Error("memo(forwardRef): __rlMeta not attached to .type.render");
  }

  if ("__rlMeta" in memoOuter) {
    throw new Error("memo(forwardRef): __rlMeta leaked to outer wrapper");
  }
  if ("__rlMeta" in forwardRefInner) {
    throw new Error("memo(forwardRef): __rlMeta leaked to inner wrapper");
  }

  console.log("PASS: memo(forwardRef()) — metadata attached to .type.render");
}

function testPlainComponentAttachment(): void {
  const component: Record<string, unknown> = {};
  const meta = createRlMeta(4, "PlainDiv", "src/PlainDiv.tsx", 1, false);
  attachRlMetaToWrapped(component, meta);

  if ((component as { __rlMeta?: RlMeta }).__rlMeta?.name !== "PlainDiv") {
    throw new Error("plain: __rlMeta not attached directly");
  }

  console.log("PASS: Plain component — metadata attached directly");
}

// =============================================================================
// Test 5: File inclusion/exclusion
// =============================================================================

function testFileInclusion(): void {
  // Should include
  if (!shouldInstrument("src/components/Button.tsx")) {
    throw new Error("Should instrument .tsx file");
  }
  if (!shouldInstrument("src/pages/Home.jsx")) {
    throw new Error("Should instrument .jsx file");
  }

  // Should exclude
  if (shouldInstrument("node_modules/react/index.js")) {
    throw new Error("Should NOT instrument node_modules");
  }
  if (shouldInstrument("src/components/Button.test.tsx")) {
    throw new Error("Should NOT instrument test files");
  }
  if (shouldInstrument("src/__tests__/utils.tsx")) {
    throw new Error("Should NOT instrument __tests__ directory");
  }
  if (shouldInstrument("src/utils.ts")) {
    throw new Error("Should NOT instrument non-JSX .ts files");
  }

  // Custom include
  if (!shouldInstrument("src/utils.ts", { include: ["**/*.ts"] })) {
    throw new Error("Custom include should match .ts files");
  }

  console.log("PASS: File inclusion/exclusion rules work correctly");
}

// =============================================================================
// Test 6: Relative path computation
// =============================================================================

function testRelativePath(): void {
  const rel = computeRelativePath("/home/user/project/src/Button.tsx", "/home/user/project");
  if (rel !== "src/Button.tsx") {
    throw new Error(`Relative path wrong: ${rel}`);
  }

  // Windows-style paths
  const relWin = computeRelativePath("C:\\Users\\dev\\project\\src\\Card.tsx", "C:\\Users\\dev\\project");
  if (relWin !== "src/Card.tsx") {
    throw new Error(`Windows relative path wrong: ${relWin}`);
  }

  // Path already relative (no-op)
  const relAlready = computeRelativePath("src/Button.tsx", "/different/root");
  if (relAlready !== "src/Button.tsx") {
    throw new Error(`Already-relative path should pass through: ${relAlready}`);
  }

  console.log("PASS: Relative path computation handles Unix, Windows, and pass-through");
}

// =============================================================================
// Test 7: Plugin NEVER emits data-rl-stack or full ancestry
// =============================================================================

function testNoFakeAncestryEmission(): void {
  // Plan transforms for a sample file
  const options = normalizeOptions({ rootDir: "/project" });
  const result = planFileTransforms("/project/src/App.tsx", [
    {
      name: "App",
      definitionLine: 5,
      hostElements: [
        { tag: "div", line: 10 },
        { tag: "h1", line: 12 },
      ],
    },
    {
      name: "Header",
      definitionLine: 20,
      hostElements: [
        { tag: "header", line: 22 },
      ],
    },
  ], options);

  // Verify only legal artifacts are produced
  for (const marker of result.sourceMarkers) {
    // data-rl-source markers must NOT encode ancestry/stack info
    const parts = marker.markerValue.split("|");
    if (parts.length !== 3) {
      throw new Error(`Source marker has wrong format (expected 3 parts): ${marker.markerValue}`);
    }

    // No "stack" or "ancestry" in marker values
    if (marker.markerValue.toLowerCase().includes("stack")) {
      throw new Error(`Source marker contains 'stack': ${marker.markerValue}`);
    }
    if (marker.markerValue.toLowerCase().includes("ancestry")) {
      throw new Error(`Source marker contains 'ancestry': ${marker.markerValue}`);
    }
  }

  // Verify metadata attachments are per-component (not per-ancestry-chain)
  for (const attachment of result.metadataAttachments) {
    const meta = attachment.meta;
    // __rlMeta is about THIS component only — no parent/child references
    if ("parent" in meta || "children" in meta || "stack" in meta) {
      throw new Error(`__rlMeta contains ancestry data: ${JSON.stringify(meta)}`);
    }
  }

  // Verify no data-rl-stack concept exists in the output
  const outputStr = JSON.stringify(result);
  if (outputStr.includes("rl-stack") || outputStr.includes("rlStack") || outputStr.includes("data-rl-stack")) {
    throw new Error("Transform result contains forbidden data-rl-stack reference");
  }

  console.log("PASS: Plugin emits ZERO ancestry/stack artifacts — only data-rl-source and __rlMeta");
}

// =============================================================================
// Test 8: Transform plan produces correct descriptors
// =============================================================================

function testTransformPlan(): void {
  const options = normalizeOptions({ rootDir: "/home/user/project", isLibrary: false });

  const result = planFileTransforms("/home/user/project/src/components/Button.tsx", [
    {
      name: "Button",
      definitionLine: 8,
      hostElements: [
        { tag: "button", line: 15 },
        { tag: "span", line: 17 },
      ],
    },
  ], options);

  // One metadata attachment
  if (result.metadataAttachments.length !== 1) {
    throw new Error(`Expected 1 metadata attachment, got ${result.metadataAttachments.length}`);
  }

  const attachment = result.metadataAttachments[0]!;
  if (attachment.componentName !== "Button") {
    throw new Error(`Component name wrong: ${attachment.componentName}`);
  }
  if (attachment.meta.file !== "src/components/Button.tsx") {
    throw new Error(`Meta file path wrong: ${attachment.meta.file}`);
  }
  if (attachment.meta.line !== 8) {
    throw new Error(`Meta line wrong: ${attachment.meta.line}`);
  }
  if (attachment.meta.isLibrary !== false) {
    throw new Error("Meta isLibrary should be false for app code");
  }

  // Two source markers (one per host element)
  if (result.sourceMarkers.length !== 2) {
    throw new Error(`Expected 2 source markers, got ${result.sourceMarkers.length}`);
  }

  const buttonMarker = result.sourceMarkers[0]!;
  if (buttonMarker.elementTag !== "button") {
    throw new Error(`Element tag wrong: ${buttonMarker.elementTag}`);
  }
  if (buttonMarker.markerValue !== "Button|src/components/Button.tsx|15") {
    throw new Error(`Marker value wrong: ${buttonMarker.markerValue}`);
  }

  console.log("PASS: Transform plan produces correct source markers and metadata attachments");
}

// =============================================================================
// Test 9: Library mode marks components as is_library
// =============================================================================

function testLibraryMode(): void {
  const options = normalizeOptions({ rootDir: "/lib", isLibrary: true });

  const result = planFileTransforms("/lib/src/DesignButton.tsx", [
    {
      name: "DesignButton",
      definitionLine: 3,
      hostElements: [{ tag: "button", line: 10 }],
    },
  ], options);

  const meta = result.metadataAttachments[0]!.meta;
  if (meta.isLibrary !== true) {
    throw new Error("Library mode should set isLibrary=true");
  }

  console.log("PASS: Library mode sets isLibrary=true on metadata");
}

// =============================================================================
// Test 10: Options normalization
// =============================================================================

function testOptionsNormalization(): void {
  // Defaults
  const defaults = normalizeOptions();
  if (defaults.stripInProduction !== true) {
    throw new Error("Default stripInProduction should be true");
  }
  if (defaults.isLibrary !== false) {
    throw new Error("Default isLibrary should be false");
  }
  if (defaults.include.length === 0) {
    throw new Error("Default include should not be empty");
  }

  // Overrides
  const custom = normalizeOptions({
    stripInProduction: false,
    isLibrary: true,
    rootDir: "/custom",
  });
  if (custom.stripInProduction !== false) {
    throw new Error("Override stripInProduction should be false");
  }
  if (custom.isLibrary !== true) {
    throw new Error("Override isLibrary should be true");
  }
  if (custom.rootDir !== "/custom") {
    throw new Error(`Override rootDir wrong: ${custom.rootDir}`);
  }

  console.log("PASS: Options normalization applies defaults and overrides correctly");
}

// =============================================================================
// Run all tests
// =============================================================================

console.log("=== Build Plugin Scaffold Tests ===\n");

testSourceMarkerEncoding();
testSourceMarkerParsing();
testRlMetaCreation();
testRlMetaAttachment();
testMemoAttachment();
testForwardRefAttachment();
testMemoForwardRefAttachment();
testPlainComponentAttachment();
testFileInclusion();
testRelativePath();
testNoFakeAncestryEmission();
testTransformPlan();
testLibraryMode();
testOptionsNormalization();

console.log("\n=== Ownership Boundary Summary ===");
console.log("BUILD-TIME (this plugin owns):");
console.log("  - data-rl-source attribute on host DOM elements → ExactSource");
console.log("  - __rlMeta on component exports → consumed by react-adapter at runtime");
console.log("");
console.log("RUNTIME (react-adapter owns):");
console.log("  - Fiber walk to build resolved_component_stack");
console.log("  - Reading __rlMeta during fiber traversal");
console.log("  - Resolution mode selection and telemetry");
console.log("  - Kill switch and degradation");
console.log("");
console.log("FORBIDDEN:");
console.log("  - data-rl-stack (NOT a real build-time artifact)");
console.log("  - Full ancestry encoding at build time");
console.log("  - Component stack as DOM attribute");

console.log("\n=== Confidence Assessment ===");
console.log("STRUCTURALLY VERIFIED:");
console.log("  - Source marker format: ComponentName|path|line (round-trip tested)");
console.log("  - Metadata attachment on plain, memo, forwardRef, memo(forwardRef)");
console.log("  - File inclusion/exclusion rules (extensions, node_modules, tests)");
console.log("  - No ancestry/stack artifacts in plugin output");
console.log("  - Library mode propagation to __rlMeta.isLibrary");
console.log("");
console.log("NOT YET PROVEN (requires integration):");
console.log("  - Real SWC AST visitor producing these transforms from JSX");
console.log("  - Real Babel AST visitor producing these transforms from JSX");
console.log("  - Next.js/Vite/webpack pipeline integration");
console.log("  - Production stripping (stripInProduction=true in a real build)");
console.log("  - react-adapter reading emitted __rlMeta in a running React app");
console.log("  - data-rl-source surviving SSR hydration");

console.log("\nAll build plugin scaffold tests passed.");
