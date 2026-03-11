# Validation — MCP and CLI

## Checkpoints

- [x] MCP tools return stable schemas — 10 tools registered with zod input schemas, proven in mcp-server.test.ts test 1
- [x] CLI commands map to same underlying contracts — 7 commands use same ApiClient interface as MCP, proven in cli-commands.test.ts (9 tests)
- [x] token scopes enforced — MCP: read-only tokens blocked from 4 mutating tools (update_bundle_status, assign_bundle, propose_resolution, validate_bundle), proven in scope-enforcement.test.ts (6 tests); CLI: read-only tokens blocked from 3 mutating commands (status, push-result, validate), proven in cli-scope.test.ts (5 tests); denied actions audited with status="denied" and error_code="SCOPE_DENIED"
- [x] agent audit entries created for every tool action — AgentAction emitted on every MCP tool call (read and mutating), proven in mcp-server.test.ts tests 2-9
- [x] Claude Code / Cursor / Codex happy-paths documented — docs/10-agent-happy-paths.md covers: MCP config (Claude Code, Cursor), all 10 tools + 4 resources documented, token scope matrix, two MCP happy paths (triage+fix, read-only analysis), CLI 7 commands + happy path, audit trail format, architecture rules for agents

## Evidence

- MCP test logs: mcp-server.test.ts (11 tests — tool registration, provenance in AgentDTO, audit event shape, error cases, mutating tools, propose_resolution, session targets, search, validate, resource templates, multiple calls)
- CLI test logs: cli-commands.test.ts (9 tests — pull, bundle, status, push-result, plan, validate, diff, all source="cli", error status)
- Activity API: activity.test.ts (7 tests — MCP/CLI events round-trip through API, filtering, pagination, contract shape)
- auth scope test cases: scope-enforcement.test.ts (6 tests — read allows reads, read denies mutations, readwrite allows all, full allows all, no permission no enforcement, denied event shape); cli-scope.test.ts (5 tests — read allows reads, read denies mutations, readwrite allows all, no permission, denied event shape)

## AgentAction contract

Defined in `@reviewlayer/contracts`:
- `id`: UUID
- `timestamp`: ISO 8601
- `actor_type`: "agent" | "human" | "system"
- `actor_id`: agent token ID
- `source`: "mcp" | "cli" | "api" | "ui"
- `action`: tool name or CLI command
- `payload`: input parameters
- `target_entity_type`: "bundle" | "session" | "project"
- `target_entity_id`: UUID
- `status`: "success" | "error" | "denied"
- `duration_ms`: execution time
- `error_code`, `error_message`: on failure
- `request_id`, `job_id`, `session_id`, `project_id`: correlation IDs

## MCP tools (10)

| # | Tool | Type | Target |
|---|------|------|--------|
| 1 | list_bundles | read | project |
| 2 | get_bundle | read | bundle |
| 3 | update_bundle_status | mutate | bundle |
| 4 | assign_bundle | mutate | bundle |
| 5 | propose_resolution | mutate | bundle |
| 6 | get_session | read | session |
| 7 | list_sessions | read | project |
| 8 | search_bundles | read | project |
| 9 | get_acceptance_criteria | read | bundle |
| 10 | validate_bundle | mutate | bundle |

## MCP resources (4)

| # | URI template | Description |
|---|-------------|-------------|
| 1 | reviewlayer://bundles/{bundleId} | Single bundle |
| 2 | reviewlayer://projects/{projectId}/bundles | Project bundles |
| 3 | reviewlayer://sessions/{sessionId} | Session details |
| 4 | reviewlayer://projects/{projectId}/sessions | Project sessions |
