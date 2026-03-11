# Validation — Triage Workspace

## Checkpoints

- [x] Exact Source block present — Displayed as separate section with heading "Exact Source", shows component_name + file_path:line. Proven in developer-triage.spec.ts tests 1, 2 ("Exact Source" visible, SubmitButton component, file path + line rendered). "Not available" with missing_reasons shown when absent (test 3).
- [x] Ancestry block present and provenance-aware — "Component Stack (N frames)" heading, each frame shows component_name + file_path + library badge. Resolution mode badge (Fiber + Meta / Leaf Only). Proven in developer-triage.spec.ts tests 1-3. Library frames marked with "(lib)".
- [x] confidence states visible — Confidence bars for Component / Design / Clarity with percentage labels. ConfidenceDot indicator (green/yellow/red). Proven in developer-triage.spec.ts test 1 ("95%" visible for component_match).
- [x] curation gate explicit — Status transition validation (5 states, 8 valid transitions) with agent resolution guard (agents blocked from resolve/reject unless project policy enables it). CurationControls component shows context-appropriate action buttons per status. API returns 422 for invalid transitions with allowed_transitions. Proven in curation-gate.test.ts (7 unit tests) and developer-triage.spec.ts (6 E2E tests)
- [x] agent activity visible and attributable — Activity tab in triage workspace with source badges (mcp/cli), actor info, expandable payload, correlation IDs, duration, error details. Proven in developer-triage.spec.ts tests 5-10 (6 E2E tests for Activity tab).
- [x] before/after comparison usable — BeforeAfterComparison component shows screenshot (before) alongside design candidate info + design_diff (after) when data available. Placeholder shown when no screenshot or low-confidence match. Developer-only (reporter surface clean). Proven in developer-triage.spec.ts tests 9-11 (3 E2E tests).
- [ ] design diff distinguishes responsive adaptation from deviation — (deferred — requires real Figma API integration + viewport-aware diff logic)

## Evidence

- developer-triage.spec.ts (23 E2E tests):
  - Tests 1-4: Provenance sections, exact_source separate from component_stack, degraded mode, developer-only fields
  - Tests 5-8: Design candidates (Code Connect badge, ranking signals expand, degraded empty, reporter clean)
  - Tests 9-11: Before/After Comparison (screenshot+diff renders, low-confidence placeholder, reporter clean)
  - Tests 12-17: Curation gate (pending_review actions, approve transition, approved actions, in_progress actions, resolved actions, reporter clean)
  - Tests 18-23: Agent Activity tab (MCP/CLI badges, empty state, expand payload, error details, default tab, reporter clean)
- figma-ranking.test.ts (10 unit tests): Candidate ranking and trace emission
- activity.test.ts (7 integration tests): Activity data persistence and retrieval
- curation-gate.test.ts (7 unit tests): Transition rules and agent resolution guard
