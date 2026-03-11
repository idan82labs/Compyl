# 00 — Program Charter

## Goal

Ship the first production-grade ReviewLayer core: reviewer feedback on staging -> ExecutionBundle -> developer triage -> agent-ready execution context -> validation -> re-review.

## What is in scope

- same-origin SDK path
- reviewer auth + handoff
- annotation capture
- runtime stack resolution for React/Next.js staging builds
- exact source provenance via `data-rl-source`
- ExecutionBundle pipeline
- developer Triage Workspace
- reporter semantic review + approval flow
- MCP + CLI surface
- Figma design intelligence via text-space diff
- version tagging / re-review / before-after evidence
- Playwright E2E and validation loops

## What is not in the first core delivery

- fully autonomous agent resolve-by-default
- enterprise SSO / audit / real-device cloud
- baseline-heavy proactive visual regression as a first-class QA product
- universal framework support
- deep server-only ancestry for pure Server Components beyond documented fallback behavior

## Acceptance criteria for the first release candidate

- One repo path (Next.js + React) is excellent.
- Runtime stack resolution is honest and instrumented, not magical.
- Reviewer and developer trust boundaries are clean.
- The ExecutionBundle schema is stable and versioned.
- MCP/CLI are usable by Claude Code / Cursor / Codex workflows.
- Playwright coverage proves the core reviewer->developer->re-review loop.
- The system degrades cleanly when ancestry or design matching is partial.

## Critical path

1. Project/repo foundations
2. Database + auth + tenancy
3. Review runtime + annotation SDK
4. Runtime stack resolution
5. ExecutionBundle + AI structuring
6. Triage / reporter UX split
7. Integrations + validation
