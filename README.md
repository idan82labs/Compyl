# Compyl

AI-native visual feedback platform that compiles stakeholder feedback into execution-ready context for developers and AI coding agents.

Reporters point at problems. Compyl resolves what they pointed at, where it lives in code, what the design intent was, and packages it all into an **ExecutionBundle** that developers and AI agents can act on immediately.

## Architecture

```
Reporter (browser) ──► SDK captures click ──► Annotation stored
                                                    │
                                         ┌──────────┴──────────┐
                                         ▼                      ▼
                                   AI Worker              React Adapter
                                (summarize, diff,     (fiber walk, rlMeta,
                                 compile bundle)       exact source)
                                         │                      │
                                         └──────────┬──────────┘
                                                    ▼
                                            ExecutionBundle
                                         (system of record)
                                                    │
                                    ┌───────────────┼───────────────┐
                                    ▼               ▼               ▼
                              Developer          MCP Server        CLI
                           Triage Workspace   (Claude/Cursor)   (Codex)
```

### Key architectural invariants

- **`exact_source`** (build-time) and **`resolved_component_stack`** (runtime) are always separate. Never merged.
- **Reporter UI** never sees code paths, severity, acceptance criteria, or design diffs.
- **Agent actions** are read/propose by default. Close/resolve is human-gated unless explicitly enabled per project.
- **Confidence is honest.** Low-confidence matches say so. Design matching is candidate ranking, not truth (unless Code Connect resolves identity).

## Monorepo Structure

```
apps/
  api/              Fastify REST API (Node.js)
  web/              Next.js 14 frontend (dashboard + reporter review)
  worker-ai/        Python AI worker (Claude API for feedback structuring)

packages/
  contracts/        Single source of truth: ExecutionBundle schema, DTOs,
                    API contracts, MCP payloads, worker job schemas
  sdk/              @reviewlayer/react — same-origin annotation SDK
  react-adapter/    Versioned React runtime adapter (fiber walk, provenance)
  build-plugin/     @reviewlayer/swc-plugin (SWC + Babel build-time instrumentation)
  mcp-server/       MCP server (embeddable + standalone)
  cli/              @reviewlayer/cli
  db/               Drizzle ORM schema, migrations, column selection
  config/           Shared config, environment validation
  ui/               Shared design system (shadcn/ui + tokens)

tests/
  e2e/              Playwright E2E tests (41 tests)

docs/               Program docs (charter, milestones, architecture)
validation/         Validation checklists with evidence records
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| API | Fastify 5 (Node.js) |
| AI Worker | Python, Claude API |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Auth | Auth.js (NextAuth v5) + SHA-256 token service |
| MCP | @modelcontextprotocol/sdk |
| Monorepo | pnpm workspaces + Turborepo |
| CI | GitHub Actions |
| E2E | Playwright |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+ (for AI worker)

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL and AUTH_SECRET

# Push schema to database (requires DATABASE_URL)
pnpm db:types

# Start all services (web :3000, api :3001, worker :8001)
pnpm dev
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in dev mode |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | TypeScript check across monorepo (20 packages) |
| `pnpm test` | Run all unit tests (209 tests) |
| `pnpm test:e2e` | Run Playwright E2E tests (41 tests) |
| `pnpm lint` | Lint with ESLint |
| `pnpm format` | Format with Prettier |
| `pnpm db:types` | Push Drizzle schema to database |
| `pnpm db:reset` | Drop and re-create all tables |

## Test Coverage

**209 unit tests** across 20 test suites + **41 Playwright E2E tests**.

### Unit tests

| Suite | Tests | What it proves |
|-------|-------|---------------|
| Boundary enforcement | 8 | Reporter/developer trust boundary at DB column level |
| Annotation boundaries | 5 | Annotation CRUD within session lifecycle |
| Annotation behavioral | 8 | Annotation type validation, session state guards |
| Bundle pipeline | 9 | Worker → bundle compilation → persistence |
| Session submit pipeline | 5 | Submit → async compilation → error isolation |
| Vertical slice | 9 | End-to-end: invite → session → annotate → compile → triage |
| Worker diagnostics | 8 | Diagnostic event emission on every job (success/failure) |
| Worker error rate | 9 | Sliding window alerting, threshold breach, recovery |
| Activity | 7 | Agent action audit trail persistence and retrieval |
| Figma ranking | 10 | Code Connect identity resolution + signal-based ranking |
| Curation gate | 7 | Status transition validation, agent resolution guard |
| Security hardening | 15 | Auth, trust boundary, transition matrix, token hashing |
| Resilience | 10 | Retry exhaustion, fan-out isolation, idempotency |
| Environment sanity | 8 | Fail-fast env validation, defaults, schema matching |
| MCP server | 17 | Tool definitions, audit trail, contract compliance |
| CLI | 14 | Command parsing, API integration, output formatting |
| React adapter | 17 | Fiber walk, kill switch, version detection |
| Web boundaries | 5 | Reporter component type discipline |
| DB boundaries | 5 | Column selection, forbidden columns |

### E2E tests (Playwright)

| Suite | Tests | What it proves |
|-------|-------|---------------|
| Developer triage | 4 | Provenance separation, degraded mode, developer-only fields |
| Design candidates | 4 | Code Connect badge, ranking signals, reporter clean |
| Before/after comparison | 3 | Screenshot + design diff rendering, low-confidence placeholder |
| Curation gate | 6 | Status transition UI, approve/reject/reopen flows |
| Agent activity | 6 | MCP/CLI badges, payload expansion, error details |
| Reporter session | 6 | Semantic-only content, provenance leakage prevention |
| Error states | 4 | API 500/422/403 error handling in UI |
| Transition cycles | 2 | Full lifecycle + rejection flow |
| Boundary abuse | 1 | Reporter ignores leaked provenance (defense in depth) |
| Mixed statuses | 1 | 5 bundles with all statuses render correctly |
| Capability URL | 3 | Submitted/active/404 session states |
| Reporter errors | 1 | Server error handling |

## Security Model

### Trust boundaries

| Role | Access | Restrictions |
|------|--------|-------------|
| Reporter | Session view (capability URL) | No provenance, no severity, no acceptance criteria |
| Member | Full developer triage workspace | Standard access |
| Admin | Organization management | Invite creation |
| Owner | Full organization control | All admin + settings |
| Agent | API token with scoped permission | Read-only, readwrite, or full. Cannot resolve/reject without project policy. |

### Key security properties

- **Invite tokens**: 32-byte random, SHA-256 hashed before storage, plaintext returned only at creation
- **Agent tokens**: SHA-256 hashed, permission-scoped, revocable
- **X-Review-Token**: Validated against accepted invite records
- **Reporter boundary**: Enforced at DB column selection, not API filtering
- **Curation gate**: 5 statuses, 8 valid transitions, agent resolution human-gated by default
- **Input validation**: Status enum, annotation type, token presence validated before processing

## Project Status

| Milestone | Status |
|-----------|--------|
| A: Foundation | Complete |
| B: Data/Auth | Complete |
| C: Review Runtime | In Progress |
| D: Runtime Resolution | In Progress |
| E: AI Pipeline | In Progress |
| F: Dual-Surface UX | In Progress |
| G: Integrations (MCP/CLI/Figma) | In Progress |
| H: Hardening | Complete |

See `progress.md` for detailed checkpoint history and `validation/` for evidence records.

## Documentation

| Document | Path |
|----------|------|
| Program charter | `docs/00-program-charter.md` |
| Operating model | `docs/01-operating-model.md` |
| Milestones | `docs/02-workstreams-and-milestones.md` |
| Task backlog | `docs/03-task-backlog.md` |
| DB boundaries | `docs/04-db-and-boundaries.md` |
| UI/UX system | `docs/05-ui-ux-system.md` |
| Validation loops | `docs/06-validation-loops.md` |
| Agent team playbook | `docs/07-agent-team-playbook.md` |
| Runtime stack arch | `docs/08-runtime-stack-resolution.md` |
| Risk register | `docs/09-risk-register.md` |
| Agent happy paths | `docs/10-agent-happy-paths.md` |

## License

Proprietary. All rights reserved.
