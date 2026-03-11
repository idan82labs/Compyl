---
name: release-readiness
description: Run a milestone closure review across architecture, validation, risk, and unresolved gaps.
context: fork
agent: security-reviewer
allowed-tools: Read, Grep, Glob, Bash
---

Assess release readiness for $ARGUMENTS.

Review:

- `progress.md`
- `docs/09-risk-register.md`
- all files in `validation/`
- latest test and e2e results

Output:

- release blockers
- soft risks
- required mitigations
- go / no-go recommendation
