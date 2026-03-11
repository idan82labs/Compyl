# Validation — API and Schema

## Checkpoints

- [x] ExecutionBundle schema versioned — `schema_version` column in execution_bundles table + `schema_version` field in contracts
- [x] Reporter DTO excludes developer-only fields — `reporterBundleColumns` (9 fields), boundary test passes
- [x] Developer DTO includes provenance fields — `developerBundleColumns` includes exact_source, resolved_component_stack separately
- [x] Agent DTOs are permission-scoped — `AGENT_IMMUTABLE_COLUMNS` defines 4 read-only fields for agents
- [ ] migrations reviewed and reversible — no migrations generated yet (Drizzle config ready)
- [ ] auth rules tested for reporter / team / owner / admin / agent — route scaffolds in place, auth middleware pending

## Evidence

- schema file: `packages/db/src/schema.ts` — 14 tables, 13 enums, 532 lines
- boundary enforcement: `packages/db/src/select.ts` — reporter/developer column maps
- boundary test: `packages/db/src/__tests__/boundary.test.ts` — PASS
- worker job tests: `apps/worker-ai/tests/test_jobs.py` — 4 tests PASS
- contract test files: validation via boundary test + worker job tests
- failing edge cases: none identified
