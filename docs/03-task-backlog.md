# 03 — Detailed Task Backlog

Each task is shaped so Claude Code can execute it with bounded context and a clear validation step.

---

## Wave 0 — Bootstrap

### T0.1 Repo initialization

Owner: foundation-engineer

- Create monorepo structure: apps/, packages/, tests/, docs/, validation/, .claude/
- pnpm workspace + turbo setup
- eslint, prettier, tsconfig hierarchy
- pnpm lint, pnpm typecheck, pnpm test, pnpm test:e2e commands (with placeholders)
- CI workflow skeleton (lint + typecheck + unit + e2e placeholders)
- .gitignore, .nvmrc, .env.example
  Done when:
- all pnpm commands exist and run (even if placeholder)
- CI runs on push
  Validation:
- smoke build passes

### T0.2 Project memory + Claude scaffolding

Owner: lead

- CLAUDE.md, progress.md, scratchpad.md
- docs/, validation/, .claude/ (agents, skills, hooks, settings)
  Done when:
- Claude Code sessions load project context consistently
- subagents are discoverable
  Validation:
- manual agent/skill discovery check

### T0.3 packages/contracts foundation

Owner: foundation-engineer

- Create packages/contracts with TypeScript project
- Define initial type stubs:
  - `ExactSource` type: `{ file_path, component_name, line, line_kind: "leaf-dom" }`
  - `ResolvedComponentFrame` type: `{ component_name, file_path?, line?, line_kind, is_library, confidence? }`
  - `ResolutionMode` enum: `fiber_meta | server_prefix | leaf_only | heuristic`
  - `LineKind` enum: `leaf-dom | definition | callsite`
  - `ExecutionBundle` type (full v8 schema)
  - `ReporterDTO`, `DeveloperDTO`, `AgentDTO` type stubs
  - `WorkerJobRequest`, `WorkerJobResponse` types
  - `WorkerJobType` enum
  - `MCP tool payload` types
- Export everything from a single entry point
  Done when:
- `packages/contracts` builds, passes typecheck
- types are importable by all other packages
  Validation:
- typecheck green
- `exact_source` and `resolved_component_stack` are distinct types with no overlap

---

## Wave 1 — Database + auth + tenancy

### T1.1 Domain model and schema draft

Owner: db-foundation-engineer

- Define tables: organizations, projects, members, reviewer_invites, review_sessions, annotations, execution_bundles, bundle_frames, agent_tokens, agent_actions, external_exports, notifications, audit_events, design_candidates
- Import ExecutionBundle / provenance types from packages/contracts
- Add bundle schema versioning
- Add provenance fields: `exact_source` (jsonb), `resolved_component_stack` (jsonb array), `resolution_mode` (enum), `missing_reasons` (text array), `root_boundary_kind` (text nullable)
  Done when:
- ERD exists
- migration set reviewed
  Validation:
- schema reviewed against `docs/04-db-and-boundaries.md`
- `exact_source` and `resolved_component_stack` are separate columns

### T1.2 RBAC + trust boundaries

Owner: db-foundation-engineer

- Separate reporter, team member, owner, admin, agent-token permissions
- Agents cannot mutate reviewer-side state
- Reporters cannot access `exact_source`, `resolved_component_stack`, design diff, severity, acceptance criteria
  Done when:
- API contract distinguishes public reporter DTOs from internal developer DTOs (types from contracts)
  Validation:
- authorization tests
- reporter cannot fetch developer-only fields

### T1.3 Invite + review token flow

Owner: backend-api-engineer

- reviewer invite issuance, acceptance, token handoff, session bootstrap
  Done when:
- reviewer can enter a project session without team credentials
  Validation:
- Playwright invite flow test

### T1.4 API ↔ Worker integration scaffold

Owner: backend-api-engineer

- Implement HTTP client in apps/api that calls worker endpoints
- Implement HTTP server in apps/worker-ai that accepts job requests
- Use types from packages/contracts for request/response
- Implement idempotency key checking
- Implement timeout + retry logic per CLAUDE.md contract
  Done when:
- API can send a dummy job and receive a response
- duplicate idempotency key returns cached result
- timeout and retry behavior verified
  Validation:
- integration test with mock job

---

## Wave 2 — App shell + design system + page consistency

### T2.1 Design token / component foundation

Owner: design-system-engineer

- Define spacing, typography, elevation, focus states, color semantics, density rules
- Build primitives: panels, toolbar, list item cards, badges, tab frames, right-side inspector, diff table, approval cards
  Done when:
- both reporter and developer surfaces share a stable visual vocabulary
  Validation:
- `validation/reporter-ui.md`
- `validation/triage-workspace.md`

### T2.2 Layout shell

Owner: app-shell-engineer

- dashboard shell, project shell, settings shell, auth shell
  Done when:
- navigation and state handling consistent across pages
  Validation:
- Playwright nav smoke tests

---

## Wave 3 — Review runtime + annotation capture

### T3.1 CompylProvider and token activation

Owner: annotation-sdk-engineer

- mount SDK only when review token is present
- ensure zero overhead in normal staging use
  Done when:
- same-origin staging activation works with zero iframe in canonical path
  Validation:
- Playwright canonical runtime tests

### T3.2 Annotation modes

Owner: annotation-sdk-engineer

- element select, freeform draw, screenshot region, full page note, reference image attach
  Done when:
- each mode produces persistent annotation payloads and screenshots
  Validation:
- `validation/reporter-ui.md`
- Playwright annotation mode matrix

### T3.3 Session persistence and autosave

Owner: backend-api-engineer

- autosave partial review state, crash-safe resume
  Done when:
- reporter can refresh / return without losing annotations
  Validation:
- Playwright resume flow

---

## Wave 4 — Runtime source + ancestry resolution (v8 critical path)

### T4.1 Build plugin metadata emission

Owner: runtime-mapping-engineer

- attach `__rlMeta = { id, name, file, line, isLibrary }` to instrumented component exports
- emit `data-rl-source` on host DOM where exact leaf provenance is known
- strip in production builds by default
  Done when:
- metadata exists in build output for supported components
- `data-rl-source` produces valid `exact_source` values
  Validation:
- plugin snapshot tests
- metadata fixture tests

### T4.2 React adapter (versioned)

Owner: runtime-mapping-engineer

- implement React-version detection
- locate nearest host fiber for clicked element
- walk `fiber.return` upward and read `__rlMeta` from wrapper-aware fields
- produce `resolved_component_stack` (NOT `exact_source` — different subsystem)
- degrade to leaf-only or heuristic mode if adapter fails
- emit adapter failure telemetry (observability)
- implement kill switch with configurable failure rate threshold
  Done when:
- supported React versions resolve ancestry in staging builds
- failures are observable and safe
- kill switch triggers at threshold
  Validation:
- `validation/runtime-stack-resolution.md`
- `validation/observability.md` (adapter telemetry checkpoints)
- fixture app matrix: portals, fragments, suspense, error boundaries, lazy, providers, HOCs, memo, forwardRef

### T4.3 ExecutionBundle provenance fields

Owner: backend-api-engineer

- Import types from packages/contracts
- API persists `exact_source` (separate field)
- API persists `resolved_component_stack` (separate field)
- API persists `resolution_mode`, per-frame `line_kind`, `missing_reasons`, `root_boundary_kind`
  Done when:
- bundle contract distinguishes exact leaf vs best-effort ancestry
- round-trip serialization preserves separation
  Validation:
- API contract tests
- JSON schema tests
- verify `exact_source` and `resolved_component_stack` are never merged in API response

### T4.4 Triage UX for provenance honesty

Owner: triage-workspace-engineer

- separate Exact Source panel from Ancestry panel
- show confidence and missing reasons
- do not pretend definition-line frames are callsite frames
- use labels: "Exact Source" and "Ancestry (best-effort)"
  Done when:
- developer can immediately tell what is exact vs inferred
  Validation:
- UX review checklist
- Playwright Triage panel assertions

### T4.5 Resolution telemetry pipeline

Owner: runtime-mapping-engineer

- every click-time resolution emits `{ resolution_mode, frame_count, missing_reasons, exact_source_available, duration_ms }`
- events flow to PostHog
- adapter failures emit `{ react_version, failure_type, fallback_mode, fiber_depth_reached }`
  Done when:
- telemetry visible in PostHog dashboard
- kill switch wired to failure rate metric
  Validation:
- `validation/observability.md`

---

## Wave 5 — ExecutionBundle + AI pipeline

### T5.1 Reviewer semantic summary flow

Owner: ai-pipeline-engineer

- raw annotation -> plain-language summary (via worker job `summarize_annotation`)
- clarification questions when needed (via worker job `generate_clarification`)
- explicit reporter approval/edit/remove actions
  Done when:
- reporter sees only semantic interpretation
- worker jobs use contracts types
  Validation:
- `validation/reporter-ui.md`
- golden prompt fixtures

### T5.2 Technical enrichment pipeline

Owner: ai-pipeline-engineer

- merge annotation context, `exact_source`, `resolved_component_stack` (always separate), Figma candidates, branch/build context
- generate title, normalized_task, category, severity, constraints, validation steps
- uses worker job `enrich_bundle` + `compile_bundle`
  Done when:
- ExecutionBundle DTO is stable and versioned
- contracts types used throughout
  Validation:
- bundle fixture snapshots
- schema contract tests

### T5.3 Confidence model

Owner: ai-pipeline-engineer

- set confidence fields and behavior thresholds
- ensure low-confidence cases stay useful but honest
  Done when:
- high/medium/low flows visible in both API and UI
  Validation:
- confidence scenario tests

### T5.4 Worker failure diagnostics

Owner: ai-pipeline-engineer

- every job logs `{ job_type, duration_ms, status, error_code, model_used, token_count, retries }`
- error rate alerting (threshold: >5%)
  Done when:
- diagnostics visible in monitoring
- alert fires on simulated high error rate
  Validation:
- `validation/observability.md`

---

## Wave 6 — Reporter and developer surfaces

### T6.1 Reporter flow polish

Owner: reporter-ux-engineer

- annotation sidebar, semantic summary approval page, save draft, re-review path
  Done when:
- non-technical reviewer can complete review without technical jargon
  Validation:
- reporter task journey Playwright suite

### T6.2 Triage Workspace

Owner: triage-workspace-engineer

- feedback detail page
- Exact Source block (from `exact_source`)
- Ancestry block (from `resolved_component_stack`, with provenance badges)
- design diff area
- acceptance criteria editor
- curation gate
- agent activity strip
  Done when:
- developers can promote, assign, and validate without leaving the workflow
- Exact Source and Ancestry are visually and semantically separate
  Validation:
- Triage Workspace E2E flows

---

## Wave 7 — Figma + GitHub intelligence

### T7.1 GitHub repo metadata service

Owner: integrations-engineer

- connect repo/branch, cache file tree and symbol metadata
- derive file candidates seeded from `exact_source` and `resolved_component_stack`
  Done when:
- file candidates available without full repo checkout in hot path
  Validation:
- integration tests against fixture repos

### T7.2 Figma candidate ranking

Owner: figma-intelligence-engineer

- deterministic path with Code Connect
- metadata-first ranking path without Code Connect
- screenshots as tie-breaker only
- do not generate design diff for low-confidence candidates
- emit ranking traces (observability): `{ candidate_count, top_confidence, ranking_signals_used, code_connect_available, duration_ms }`
  Done when:
- design candidates and confidence evidence are stable
  Validation:
- `validation/figma-diff.md`
- `validation/observability.md`
- fixture ranking tests

### T7.3 Text-space diff

Owner: figma-intelligence-engineer

- compare DOM computed style + viewport context against Figma design context
- suppress responsive false positives
- uses worker job `compute_design_diff`
  Done when:
- diff quality is useful, not noise
  Validation:
- design diff precision fixtures

---

## Wave 8 — MCP / CLI / agent access

### T8.1 MCP server

Owner: agent-platform-engineer

- resources and tools per v8 spec (10 tools, 4 resources)
- all payloads from packages/contracts
- every tool call logged as AgentAction (observability)
  Done when:
- Claude Code / Cursor / Codex workflows can consume bundles
  Validation:
- `validation/mcp-cli.md`
- `validation/observability.md`
- MCP contract tests

### T8.2 CLI

Owner: agent-platform-engineer

- `reviewlayer pull`, `bundle`, `diff`, `status`, `plan`, `push-result`, `validate`
- same contracts as MCP
- every command logged as AgentAction (observability)
  Done when:
- CLI is stable for scripted use in CI or agent shells
  Validation:
- CLI integration tests

### T8.3 Agent policy and audit trail

Owner: security-reviewer + backend-api-engineer

- token scopes, plan/resolve permissions, action logging
  Done when:
- every agent action attributable and policy-checked
  Validation:
- auth tests + audit log tests

---

## Wave 9 — Notifications, exports, versioning

### T9.1 Version tagging / before-after / re-review

Owner: backend-api-engineer

- tie review sessions to branch, commit, build URL
- generate re-review notifications
  Done when:
- reporter can verify fixes against previous state
  Validation:
- re-review Playwright suite

### T9.2 Export surfaces

Owner: integrations-engineer

- GitHub Issues / Jira / Linear / Slack
- no auto-export; always curation-gated
  Done when:
- structured tasks export cleanly without backlog spam
  Validation:
- export contract tests with mocks

---

## Wave 10 — Hardening and release

### T10.1 Playwright full matrix

Owner: qa-playwright-engineer

- reviewer flows, developer flows, auth/roles, runtime provenance, re-review loop
- canonical path + fallback path smoke coverage
  Done when:
- full green suite in CI
  Validation:
- `validation/e2e-matrix.md`

### T10.2 Performance / reliability review

Owner: platform-architect

- SDK overhead in non-review mode
- click-time resolution latency
- bundle-generation SLOs
  Done when:
- no showstopper performance regressions remain

### T10.3 Security + privacy review

Owner: security-reviewer

- invite token handling, screenshot/object storage, agent token security, reviewer privacy boundaries
  Done when:
- threat model and mitigation checklist signed off

### T10.4 Observability dashboard review

Owner: lead

- verify all telemetry endpoints active
- adapter failure telemetry, resolution_mode metrics, missing_reasons, Figma ranking traces, worker diagnostics, MCP/CLI audit
  Done when:
- all observability checkpoints in `validation/observability.md` have evidence
  Validation:
- `validation/observability.md` fully green
