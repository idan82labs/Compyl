# Validation — packages/contracts

## Naming discipline

- [x] `ExactSource` type is a single frame type (never an array) — line 41-46, interface with single fields
- [x] `ResolvedComponentFrame` type is used in arrays for `resolved_component_stack` — line 157, `ResolvedComponentFrame[]`
- [x] No type or field named generically "component_stack" or "source_stack" — grep confirms 0 matches
- [x] `exact_source` and `resolved_component_stack` are separate fields in ExecutionBundle — lines 156-157
- [x] Reporter DTO excludes both `exact_source` and `resolved_component_stack` — ReporterDTO (lines 196-209) has neither
- [x] Developer DTO includes both as separate fields — lines 231-232
- [x] Agent DTO includes both as separate fields — line 261, type alias to ExecutionBundle

## API ↔ Worker contract

- [x] `WorkerJobRequest` type defined — line 277-283
- [x] `WorkerJobResponse` type defined — line 291-297
- [x] `WorkerJobType` enum covers all 6 job types — lines 267-273
- [x] Idempotency key field present in request type — `idempotency_key: string` line 281
- [x] Error type includes `retryable` boolean — `WorkerJobError.retryable: boolean` line 288
- [x] `WorkerJobRequest` type used by apps/api — worker-client.ts imports and uses it
- [x] `WorkerJobResponse` type used by apps/api — worker-client.ts imports and uses it

## MCP payloads

- [x] All 10 MCP tool parameter types defined in contracts — McpListBundlesInput, McpGetBundleInput, McpUpdateBundleStatusInput, McpAssignBundleInput, McpProposeResolutionInput, McpGetSessionInput, McpListSessionsInput, McpSearchBundlesInput, McpGetAcceptanceCriteriaInput, McpValidateBundleInput (lines 419-489)
- [x] All 10 MCP tool response types defined in contracts — Tools return AgentDTO (bundles), session objects, and operation results; response shapes implied by ApiClient interface in mcp-server
- [x] MCP payloads reference `ExactSource` and `ResolvedComponentFrame` types — AgentDTO (= ExecutionBundle) includes both as separate fields, returned by get_bundle and list_bundles tools

## DTO boundaries

- [x] ReporterDTO type has NO fields from developer/agent context — verified: no file paths, no provenance, no severity, no acceptance criteria
- [x] DeveloperDTO type includes provenance fields — exact_source, resolved_component_stack, resolution_mode, missing_reasons, root_boundary_kind
- [x] AgentDTO type includes full ExecutionBundle reference — `type AgentDTO = ExecutionBundle`
- [x] Schema version field present — `schema_version: string` in ExecutionBundle

## Evidence

- typecheck output: `pnpm --filter @reviewlayer/contracts typecheck` — PASS (0 errors)
- build output: `pnpm --filter @reviewlayer/contracts build` — produces dist/index.js + dist/index.d.ts
- full workspace typecheck: 17/17 tasks pass
- boundary test: `packages/db/src/__tests__/boundary.test.ts` — 9 reporter columns, 23 forbidden excluded
- worker job tests: `apps/worker-ai/tests/test_jobs.py` — 4 tests pass (valid job, invalid type, idempotency, all 6 types)
- import verification: sdk, react-adapter, build-plugin, mcp-server, cli, db, api, web all have `@reviewlayer/contracts: workspace:*` dependency
