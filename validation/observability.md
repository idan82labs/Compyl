# Validation — Observability & Diagnostics

## Checkpoints

- [x] React adapter failure telemetry emitting structured events (onFailure callback proven in runtime-provenance tests 10, 16)
- [x] resolution_mode telemetry on every click-time resolution (onTelemetry callback proven in runtime-provenance tests 14-16)
- [x] missing_reasons logged for every partial ancestry result (onTelemetry includes missing_reasons, proven in test 15)
- [x] Adapter kill switch triggers at configurable failure rate threshold (proven in kill-switch.test.ts)
- [x] Figma candidate ranking traces logged with signals used and confidence — FigmaRankingTraceEvent emitted on every ranking operation with: bundle_id, candidate_count, top_confidence, ranking_signals_used, code_connect_available, duration_ms, candidate_list (full), ranking_reason, no_match, fallback_used. Proven in figma-ranking.test.ts (10 tests)
- [x] AI worker job diagnostics: duration, status, error code, retries (API-side proven via worker-diagnostics.test.ts; model_used/token_count deferred to Python worker)
- [x] AI worker error rate alerting (threshold: >5%) — sliding window tracker with configurable threshold/minSample/window, proven in worker-error-rate.test.ts (9 tests), wired into sessions route
- [x] MCP tool calls logged as AgentAction with full payload — every tool call emits AgentAction via AuditEmitter, proven in mcp-server.test.ts (11 tests)
- [x] CLI commands logged as AgentAction with full payload — every CLI command emits AgentAction with source="cli", proven in cli-commands.test.ts (9 tests)
- [x] Agent Activity tab renders all logged actions queryable — API route (GET/POST /projects/:projectId/activity) proven in activity.test.ts (7 tests); UI tab with filters, pagination, expand/collapse proven in developer-triage.spec.ts (6 E2E tests)
- [x] API ↔ Worker job idempotency verified (unique keys per annotation/session proven in vertical-slice.test.ts test 4; worker-side cache dedup proven in test_jobs.py)

## Evidence

- telemetry event samples: ResolutionTelemetryEvent shape proven in runtime-provenance.test.ts
- adapter failure scenario test: kill-switch.test.ts (trip/reset/threshold)
- kill switch trigger test: kill-switch.test.ts test 1-4
- Figma ranking trace sample: figma-ranking.test.ts (10 tests — Code Connect identity resolution, signal-based ranking, low-confidence no-diff, trace shape, no-match trace, exact_source signal priority, combined signals, stack-based Code Connect, normalized matching, signals recorded on candidates)
- worker failure diagnostic sample: worker-diagnostics.test.ts (8 tests — success, failure, retry, timeout, network error, HTTP error, shape validation)
- error rate alerting: worker-error-rate.test.ts (9 tests — threshold, minSample, sliding window, recovery, status classification, custom threshold)
- agent action log sample: activity.test.ts (7 tests — empty state, ingest/retrieve, MCP round-trip, CLI round-trip, mixed sources, pagination, contract shape); developer-triage.spec.ts (6 E2E tests — MCP/CLI badges, empty state, expand payload, error details, default tab, reporter unaffected)
