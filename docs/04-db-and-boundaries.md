# 04 — Database and Boundary Plan

## Boundary principle

Reviewer-facing state and developer-facing state are not the same object graph.

## Core tables

- organizations
- organization_members
- projects
- reviewer_invites
- review_sessions
- annotations
- execution_bundles
- execution_bundle_frames
- design_candidates
- agent_tokens
- agent_actions
- external_exports
- notifications
- audit_events

## DTO boundaries (defined in packages/contracts)

### Reporter DTO

Allowed:

- session metadata
- annotation payloads
- plain-language summaries
- clarification prompts
- item approval/rejection state
- re-review notifications

Forbidden:

- file paths
- component ancestry details (`resolved_component_stack`)
- `exact_source` details
- design diff internals
- severity classifications intended for developers
- agent plan content

### Developer DTO

Allowed:

- `exact_source` (always separate from ancestry)
- `resolved_component_stack` (always separate from exact source)
- provenance fields (`resolution_mode`, `line_kind`, `missing_reasons`, `root_boundary_kind`)
- design candidates and design diff
- confidence model
- acceptance criteria
- agent actions / audit trail

### Agent DTO

Allowed:

- full ExecutionBundle
- constrained mutation endpoints
- no direct write access to reviewer summaries or invite/token state

## Schema-level rules

- Every ExecutionBundle has `schema_version`.
- Every bundle-frame carries `line_kind` (leaf-dom | definition | callsite).
- `exact_source` and `resolved_component_stack` are always separate fields — never merged.
- Provenance is explicit, never inferred from missing fields.
- Partial ancestry is valid and must serialize honestly.
- Soft-delete content only where auditability matters; otherwise archive explicitly.

## API ↔ Worker boundary (defined in packages/contracts)

- Job types: `summarize_annotation`, `generate_clarification`, `enrich_bundle`, `compute_design_diff`, `compile_bundle`, `generate_acceptance_criteria`
- Every job request carries `{ job_id, job_type, payload, idempotency_key, created_at }`
- Every job response carries `{ job_id, status, result, error?, duration_ms }`
- The contracts package is the single source of truth for these types

## Multi-tenant requirements

- All project data is tenant-scoped.
- Reviewer tokens are project+session scoped, not broad tenant tokens.
- Agent tokens are project-scoped with explicit permission levels.
- External exports carry project ownership and origin bundle IDs.

## Migration policy

- No destructive migration without a reversible plan.
- Every migration must have: forward SQL, rollback strategy, data compatibility note, validation query.
- Schema changes touching bundle or auth models require plan approval before implementation.
