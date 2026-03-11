# 09 — Risk Register

## R1 — React private internals drift

Impact: high
Mitigation:

- versioned adapter
- telemetry on adapter failures
- kill switch to leaf-only mode
- explicit support matrix

## R2 — Figma candidate ranking noise

Impact: medium/high
Mitigation:

- metadata-first ranking
- screenshot as tie-breaker only
- low-confidence means no auto diff
- developer confirmation gate

## R3 — Reviewer/developer boundary leaks

Impact: high
Mitigation:

- separate DTOs
- reviewer API contract tests
- explicit page-level permission tests

## R4 — Agent overreach

Impact: high
Mitigation:

- read/propose default policy
- scoped tokens
- full audit trail
- human-gated resolve by default

## R5 — Same-file multi-agent conflicts

Impact: medium
Mitigation:

- serialized ownership
- worktree isolation for risky subagents
- avoid teams for same-file edits

## R6 — Validation rot

Impact: medium
Mitigation:

- validation docs are merge gates
- hooks block incomplete task completion
- Playwright traces retained on CI failures

## R7 — Observability gaps causing silent failures

Impact: high
Mitigation:

- telemetry ships WITH the feature, not after
- adapter failure telemetry is a Milestone D gate
- AI worker diagnostics are a Milestone E gate
- Figma ranking traces are a Milestone G gate
- MCP/CLI audit logging is a Milestone G gate
- observability dashboard review is a Milestone H gate

## R8 — API ↔ Worker contract drift

Impact: medium/high
Mitigation:

- all job schemas defined in packages/contracts (single source of truth)
- both API and worker import from contracts — no duplication
- contract tests validate request/response shape compatibility
- schema version field on jobs for forward compatibility

## R9 — exact_source / resolved_component_stack naming confusion

Impact: medium
Mitigation:

- canonical names enforced via packages/contracts type exports
- CLAUDE.md explicitly forbids blurring
- code review gate: any PR touching provenance fields is checked against naming discipline
- linting rule (custom ESLint) to flag generic "component stack" naming
