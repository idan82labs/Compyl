# Compyl — Project Memory (CLAUDE.md)

## Mission

Build Compyl: an AI-native feedback platform that compiles stakeholder visual feedback into execution-ready context (ExecutionBundles) for human developers and AI coding agents.

## Non-negotiable architectural truths

1. `data-rl-source` is the ONLY guaranteed build-time DOM artifact — it marks the exact leaf/render-site.
2. `resolved_component_stack` is a RUNTIME SDK result produced on click (fiber walk + `__rlMeta`), never a static DOM attribute.
3. Full ancestry is NOT a build-time artifact. It is resolved at click time via a versioned React adapter over React internals.
4. The system MUST distinguish exact source (build-time) from best-effort ancestry (runtime).
5. Provenance is explicit in schema and UI — `resolution_mode`, `line_kind`, `missing_reasons`, `root_boundary_kind`.
6. Default mode vs deep mode are separate. Default: exact leaf + ancestor definition lines. Deep: opt-in callsite lines + stack-ID threading.
7. Graceful degradation is required. The system must work (reduced) when ancestry fails.
8. React private internals drift is an operational risk managed via adapter versioning, telemetry, and kill switch.
9. Reporter UI NEVER shows code/file paths, design diffs, severity internals, or acceptance criteria.
10. Developer Triage Workspace separates Exact Source from Ancestry with visible provenance.
11. ExecutionBundle is the system-of-record object shared across UI, exports, MCP, CLI, and validation.
12. Agent actions are read/propose by default; close/resolve is human-gated unless explicitly enabled per project.

## Forbidden shortcuts

- NEVER reintroduce `data-rl-stack` as a build-time DOM attribute.
- NEVER collapse "best effort" ancestry into "exact" in schema, UI, or API.
- NEVER expose developer-only fields to reporter surfaces.
- NEVER auto-export feedback to external tools without curation gate.
- NEVER let agents close items without explicit project policy enabling it.
- NEVER hide uncertainty — model it explicitly via confidence + missing_reasons.
- NEVER merge work without validation evidence.
- NEVER promise build-time full ancestry — it requires runtime resolution.

## Build principles

- Canonical same-origin SDK path over proxy/script-tag fallbacks.
- Cost on click, not on render.
- Schema before UI polish.
- Provenance before convenience.
- Runtime truth before marketing language.
- Validation before expansion.
- Prefer explicit contracts over vague descriptions.

## Technology stack

- **Frontend**: Next.js 14+ / React 18 / shadcn/ui / TailwindCSS
- **API**: Fastify (Node.js) — REST + WebSocket
- **AI Worker**: Python microservice — Claude API for feedback structuring
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Cache**: Redis (Upstash)
- **Object Storage**: Cloudflare R2
- **Auth**: Auth.js (NextAuth v5) + custom token service
- **MCP**: Node.js, @modelcontextprotocol/sdk
- **Hosting**: Vercel (frontend) + Railway (API/Python/MCP)
- **CI**: GitHub Actions
- **Monitoring**: Sentry + PostHog

## Monorepo structure

```
apps/
  web/            — Next.js frontend (dashboard + reporter review)
  api/            — Fastify API server
  worker-ai/      — Python AI processing service
packages/
  contracts/      — SINGLE SOURCE OF TRUTH: ExecutionBundle schema, provenance types,
                    API DTOs (reporter/developer/agent), MCP tool payloads,
                    API↔worker job schemas, shared enums/constants
  sdk/            — @reviewlayer/react (same-origin annotation SDK)
  react-adapter/  — Versioned React runtime adapter + resolver
  build-plugin/   — @reviewlayer/swc-plugin (SWC + Babel)
  mcp-server/     — MCP server (embeddable + standalone)
  cli/            — @reviewlayer/cli
  ui/             — Shared design system (shadcn/ui + tokens)
  db/             — Drizzle schema + migrations
  config/         — Shared config, env validation, constants
tests/
  e2e/            — Playwright E2E tests
docs/
  *.md            — Program docs (charter, milestones, backlog, etc.)
validation/
  *.md            — Validation checklists + evidence records
.claude/
  agents/         — Subagent definitions
  skills/         — Skill definitions
  hooks/          — Hook scripts
  settings.json   — Claude Code settings
```

## packages/contracts — naming discipline

The `contracts` package enforces the naming split everywhere:

- `exact_source` — build-time leaf/render-site from `data-rl-source`. Always a single frame.
- `resolved_component_stack` — runtime-resolved ancestry from fiber walk + `__rlMeta`. Always an array of frames.
  These are NEVER blurred into a generic "component stack" or "source stack". Every type, DTO, API endpoint, MCP payload, and UI component must use the canonical names.

## API ↔ Python Worker contract (provisional)

**Transport**: HTTP (REST). Worker exposes endpoints consumed only by the API server.
**Job schema**: `{ job_id: uuid, job_type: enum, payload: typed-per-job, idempotency_key: string, created_at: ISO8601 }`
**Response schema**: `{ job_id: uuid, status: "completed" | "failed" | "partial", result: typed-per-job, error?: { code, message, retryable }, duration_ms: number }`
**Timeout**: 30s default, 60s for Figma diff jobs, 120s for complex multi-annotation bundles.
**Retry policy**: API retries failed jobs up to 3 times with exponential backoff (1s, 4s, 16s). Only when `error.retryable === true`.
**Idempotency**: Every job carries an `idempotency_key`. Worker must return cached result for duplicate keys within 1 hour.
**Sync vs async rules**:

- **Sync** (HTTP request/response): single-annotation summary, clarification generation, design diff for one component.
- **Async** (enqueue + poll/webhook): full ExecutionBundle compilation for multi-annotation sessions, batch operations.
- Phase 1 uses sync HTTP for simplicity. Phase 2+ adds BullMQ/Redis queue for async jobs.
  **Job types** (defined in `packages/contracts`):
- `summarize_annotation` — raw annotation → plain-language summary
- `generate_clarification` — ambiguous annotation → clarification question
- `enrich_bundle` — annotation context + source + ancestry + Figma → technical enrichment
- `compute_design_diff` — DOM computed styles + Figma context → semantic diff
- `compile_bundle` — all enrichments → final ExecutionBundle
- `generate_acceptance_criteria` — bundle context → acceptance criteria + validation steps

## Package manager

`pnpm` exclusively. No npm or yarn.

## Commands

- Install: `pnpm install`
- Dev (all): `pnpm dev`
- Typecheck: `pnpm typecheck`
- Unit tests: `pnpm test`
- Lint: `pnpm lint`
- Playwright E2E: `pnpm test:e2e`
- DB reset: `pnpm db:reset`
- DB generate types: `pnpm db:types`
- Build: `pnpm build`

## Claude Code operating model

- **Lead session**: opus — architecture, orchestration, acceptance, red-team review.
- **Implementation subagents**: sonnet by default.
- **Exceptions**: `ai-pipeline-engineer` and `runtime-mapping-engineer` use opus (deliberate — these are the highest-complexity subsystems).
- **Exploration**: built-in `Explore` / haiku for fast read-only discovery.
- **Agent teams**: Only when tasks are parallelizable AND file ownership is disjoint. Default to subagents.

## Subagent rules

- One owner per task.
- One owning agent per file cluster.
- Same-file edits are serialized.
- DB schema changes require plan approval before implementation.
- Runtime React adapter changes require plan approval.
- Hook and settings changes require separate review.

## Observability / diagnostics workstream

This is a cross-cutting concern, not a single milestone. Every subsystem must emit structured diagnostics:

1. **React adapter failures**: telemetry event on every adapter failure with `{ react_version, failure_type, fallback_mode, fiber_depth_reached }`. Kill switch trigger threshold configurable.
2. **resolution_mode telemetry**: every click-time resolution emits `{ resolution_mode, frame_count, missing_reasons, duration_ms }` to analytics pipeline (PostHog).
3. **missing_reasons logging**: structured log for every partial ancestry result. Aggregated for adapter health dashboards.
4. **Figma candidate ranking traces**: for every ranking operation, log `{ candidate_count, top_confidence, ranking_signals_used, code_connect_available, duration_ms }`.
5. **AI worker failure diagnostics**: every worker job logs `{ job_type, duration_ms, status, error_code, model_used, token_count, retries }`. Alert on error rate > 5%.
6. **MCP/CLI auditability**: every MCP tool call and CLI command logged as `AgentAction` with full payload. Queryable in Agent Activity tab and via API.

Diagnostics are NOT optional polish. They ship WITH the feature, not after.

## Documentation map

- Program charter: `docs/00-program-charter.md`
- Operating model: `docs/01-operating-model.md`
- Milestones: `docs/02-workstreams-and-milestones.md`
- Task backlog: `docs/03-task-backlog.md`
- DB boundaries: `docs/04-db-and-boundaries.md`
- UI/UX system: `docs/05-ui-ux-system.md`
- Validation loops: `docs/06-validation-loops.md`
- Agent team playbook: `docs/07-agent-team-playbook.md`
- Runtime stack architecture: `docs/08-runtime-stack-resolution.md`
- Risk register: `docs/09-risk-register.md`

## Execution discipline

### Continuation rule

Checkpoint completion is NOT a stop signal. After each completed checkpoint:
1. Update `progress.md`
2. Update `scratchpad.md` if needed
3. Record validation evidence
4. Select the next dependency-safe task
5. Continue immediately

Stop only when: a hard blocker exists, a validation failure makes forward work unsafe, or the session/runtime/tool budget is exhausted. Never pause merely because a phase or checkpoint was completed.

### Checkpoint reporting

Checkpoint reports are for bookkeeping and resumability, not for asking permission to continue.

### Memory discipline

- Update `progress.md` after every completed task cluster.
- Use `scratchpad.md` for ephemeral notes, dead ends, and hypotheses.
- Convert enduring decisions into docs or ADR-style notes.
- Before closing a task, attach validation evidence and update relevant validation markdown.

### Architecture preservation

These truths are enforced across all work:
- `exact_source` and `resolved_component_stack` remain separate everywhere — schema, API, UI, contracts, tests.
- `data-rl-source` is real build-time; full ancestry is runtime-resolved, never a build-time DOM artifact.
- `packages/contracts` is the single source of truth for shared types, DTOs, worker contracts, MCP payloads.
- `packages/react-adapter` owns runtime stack resolution, provenance, version detection, telemetry, kill-switch.
- `packages/build-plugin` owns build-time instrumentation only.
- Observability is implementation, not polish — ships WITH the feature.
- Reporter/developer boundaries are strict and tested.
- Graceful degradation is explicit in schema, UI, and validation.
- Do not reintroduce `data-rl-stack` as a fake build-time contract.

### Validation rule

Every phase/checkpoint must validate before continuing. Validation success triggers continuation, not pausing.

## Definition of done for any feature

1. Code implemented
2. Tests added/updated
3. Validation markdown updated with evidence
4. UX checked against `docs/05-ui-ux-system.md`
5. Boundaries checked against `docs/04-db-and-boundaries.md`
6. `progress.md` updated
7. Known limitations recorded if anything is degraded or deferred

## Git conventions

- Author: `Idan Tal <idan.t@82labs.io>`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Feature branches off `main`
- No force push to main
