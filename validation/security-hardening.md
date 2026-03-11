# Validation — Security Hardening (Phase H)

## Checkpoints

- [x] X-Review-Token validated against accepted invites — SHA-256 hash lookup in reviewerInvites table, only "accepted" status grants reporter auth. Invalid/expired tokens return 401. Proven in security-hardening.test.ts test 14.
- [x] PATCH input validation — unknown status values rejected with 400 before transition check. 5 valid statuses validated, invalid/malformed rejected. Proven in security-hardening.test.ts test 12.
- [x] Invite accept validation — empty/null/whitespace-only tokens rejected with 400. Proven in security-hardening.test.ts test 13.
- [x] Annotation type validation — only 5 known types accepted, invalid types rejected with 400. Proven in security-hardening.test.ts test 15.
- [x] Exhaustive transition matrix — all 12 invalid transitions blocked, 8 valid confirmed, no self-loops. Proven in security-hardening.test.ts test 1.
- [x] Reporter trust boundary — 9 safe fields, 26+ developer-only, zero overlap, critical provenance fields blocked. Proven in security-hardening.test.ts test 3.
- [x] Agent resolution guard — 2 gated statuses, 3 open, exhaustive coverage. Proven in security-hardening.test.ts test 5.
- [x] Auth role hierarchy — reporter isolated from developer endpoints, team roles for invites. Proven in security-hardening.test.ts test 8.
- [x] Token hashing — SHA-256 deterministic, one-way, correct length. Proven in security-hardening.test.ts test 2.
- [x] Transition reachability — BFS proves all states reachable + reversible (no dead ends). Proven in security-hardening.test.ts tests 9-10.
- [x] Boundary abuse defense in depth — reporter UI ignores provenance data even if API leaks it. Proven in hardening-error-states.spec.ts boundary abuse test.
- [ ] CORS origin whitelist — currently origin: true (permissive). Deferred to production domain setup.
- [ ] Rate limiting — no @fastify/rate-limit integration. Deferred to production.
- [ ] Auth.js session integration — TODO in middleware. Deferred to auth subsystem.

## Evidence

- security-hardening.test.ts (15 unit tests): exhaustive transition matrix, token hashing, trust boundary, agent-immutable, agent resolution guard, session submit state machine, provenance naming, auth hierarchy, reachability, reversibility, CORS awareness, PATCH validation, invite validation, review token validation, annotation type validation
- hardening-error-states.spec.ts (12 E2E tests): error states (4), transition cycles (2), boundary abuse (1), mixed statuses (1), capability URL edge cases (3), reporter 500 (1)
- Code changes: auth.ts (X-Review-Token validation), bundles.ts (status input validation), invites.ts (token validation), annotations.ts (type + page_url validation)
