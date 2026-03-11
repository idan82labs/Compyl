# 02 — Workstreams and Milestones

## Milestone A — Repo + platform foundation

**Goal:** Get a stable monorepo/app foundation with conventions, CI, and a real local/staging environment.

Deliverables:

- Next.js app shell
- pnpm workspace + turbo setup
- lint / typecheck / unit test / e2e test commands
- local env templates
- CI pipeline skeleton
- packages/contracts stub with initial type definitions
- seeded staging-like environment

## Milestone B — Data, tenancy, and auth boundaries

**Goal:** Establish irreversible foundation decisions before feature work sprawls.

Deliverables:

- org / project / member / reviewer invite model
- review session model
- annotation model
- ExecutionBundle model + versioning strategy (types from packages/contracts)
- agent token model and RBAC
- RLS / service-role boundary decisions
- API ↔ worker job schema (defined in packages/contracts)
- Reporter / Developer / Agent DTO separation (defined in packages/contracts)

## Milestone C — Canonical review runtime

**Goal:** Make the reviewer experience real end to end on staging.

Deliverables:

- token handoff flow
- same-origin SDK activation
- toolbar / annotation modes
- screenshot + overlay capture
- session persistence

## Milestone D — Runtime source + ancestry resolution

**Goal:** Make v8's stack story real.

Deliverables:

- build plugin adds `__rlMeta`
- exact leaf provenance via `data-rl-source`
- versioned React adapter
- runtime `resolved_component_stack` (NEVER blurred with `exact_source`)
- provenance metadata in ExecutionBundle
- partial/fallback behavior surfaced honestly in UI
- resolution_mode telemetry + missing_reasons logging (observability)
- adapter failure diagnostics + kill switch

## Milestone E — AI and ExecutionBundle pipeline

**Goal:** Turn feedback into a durable, versioned task object.

Deliverables:

- annotation -> summary -> approved task flow
- technical enrichment pipeline
- API ↔ worker integration using contracts job schema
- confidence model
- acceptance criteria generation
- constraints / validation_steps generation
- worker failure diagnostics (observability)

## Milestone F — Dual-surface product UX

**Goal:** Reporter and developer workflows both feel coherent.

Deliverables:

- reporter semantic summary and clarification flow
- developer Triage Workspace
- Exact Source vs Ancestry split (using canonical names from contracts)
- curation gate
- version / re-review / before-after evidence

## Milestone G — Integrations and agent surfaces

**Goal:** Deliver the AI-native wedge.

Deliverables:

- GitHub connect + cached repo metadata
- Figma connect + candidate ranking + diff
- Figma ranking traces (observability)
- MCP server (payloads from packages/contracts)
- CLI (same contracts)
- agent audit trail
- MCP/CLI auditability logging (observability)

## Milestone H — Hardening and release gates

**Goal:** Make the core trustworthy.

Deliverables:

- Playwright matrix green
- API/schema contract checks green
- DB migration safety checks green
- security/privacy review
- performance budget review
- observability dashboard review (all telemetry endpoints active)
- release checklist and rollback plan
