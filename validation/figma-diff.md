# Validation — Figma Diff / Design Intelligence

## Checkpoints

- [x] Code Connect path deterministic — When Code Connect mappings exist, resolution is immediate with confidence=1.0, is_code_connect=true, and should_compute_diff=true. Proven in figma-ranking.test.ts tests 1, 8.
- [x] no-Code-Connect path uses metadata-first ranking — Signal-based ranking uses exact_source name (0.35), component_stack name (0.25), visible text (0.15), page context (0.10), figma metadata (0.10), DOM role (0.05). Proven in figma-ranking.test.ts tests 2, 6, 7.
- [ ] screenshots used only as tie-breaker — (deferred — screenshot similarity not yet implemented; architecture reserves it as tie-breaker only)
- [x] low-confidence matches do not produce auto diff — should_compute_diff is false when top confidence < 0.6. Proven in figma-ranking.test.ts test 3.
- [ ] responsive adaptations are not over-flagged — (deferred — requires real Figma API integration and viewport-aware diff logic)

## Evidence

- figma-ranking.test.ts (10 tests):
  1. Code Connect identity resolution via exact_source (confidence=1.0, is_code_connect=true)
  2. Signal-based ranking produces honest confidence < 1.0 with signals
  3. Low-confidence matches do NOT trigger automatic design diff
  4. Ranking trace has full diagnostic shape (bundle_id, candidate_list, ranking_reason, no_match)
  5. Empty component list produces no-match trace with candidate_count=0
  6. exact_source name match is the strongest non-Code-Connect ranking signal
  7. Multiple signals (exact_source + stack) combine for higher confidence
  8. Code Connect resolves via component stack when exact_source doesn't match
  9. Normalized matching handles case, separators, and suffixes
  10. Ranking signals are recorded on each candidate for transparency
- developer-triage.spec.ts (4 E2E tests):
  1. Code Connect candidate shows badge and 100% confidence
  2. Expanding a candidate shows ranking signals
  3. Degraded bundle shows no Design Candidates section
  4. Reporter surface does NOT show design candidates
- precision notes: Code Connect = exact (1.0), multi-signal max ≈ 0.60 (honest ceiling), normalized name matching covers case/separator/suffix differences
