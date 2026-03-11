# 06 — Validation Loops

## Philosophy

Every workstream has its own validation artifact and a global E2E proof. No workstream is complete if it only “looks plausible.”

## Validation layers

### Layer 1 — Local task validation

Run immediately after task completion:

- lint
- typecheck
- task-targeted unit/integration tests
- task-specific validation markdown updated

### Layer 2 — Workstream validation

Run before merging a cluster of tasks:

- API contract tests
- DB migration review
- UI consistency checks
- Playwright subset for affected flows

### Layer 3 — Milestone validation

Run before milestone closure:

- full Playwright suite
- critical-path manual review
- bundle schema compatibility check
- performance smoke

## Required validation docs

- `validation/contracts.md` — packages/contracts naming discipline, DTO boundaries, worker contract
- `validation/api-and-schema.md` — API schema, migrations, auth rules
- `validation/runtime-stack-resolution.md` — exact_source vs resolved_component_stack scenarios
- `validation/reporter-ui.md` — no technical leakage, semantic UX
- `validation/triage-workspace.md` — Exact Source / Ancestry separation, provenance
- `validation/figma-diff.md` — candidate ranking, Code Connect, responsive awareness
- `validation/mcp-cli.md` — MCP tools, CLI commands, agent audit
- `validation/observability.md` — telemetry, diagnostics, kill switch, alerting
- `validation/e2e-matrix.md` — full Playwright suite

## Hook-enforced checks

Use Claude Code hooks for:

- async targeted checks after edits
- blocking task completion if required evidence is missing
- blocking teammate idle state when their deliverable is incomplete
- auditing config/hook changes

## Evidence standard

A task only closes when there is evidence:

- test output summary
- screenshots or traces for UI flows
- schema diff / migration proof for DB changes
- recorded limitations for degraded behavior
