# 07 — Agent Team Playbook

## Recommendation

Default to a lead session + subagents.
Use experimental agent teams only for bounded, parallelizable work where file ownership is disjoint and teammates benefit from comparing findings.

## Why

Agent teams are powerful but experimental. They carry coordination overhead, use materially more tokens, and are best when teammates can work independently and message each other. Do not make them the default for every feature.

## Best team shapes for Compyl

### Shape A — Parallel research/review

Use for:

- evaluating architecture choices
- red-teaming a design
- reviewing a milestone across security / performance / UX / testability

Suggested team:

- architecture reviewer
- security/privacy reviewer
- DX/operability reviewer
- devil’s advocate

### Shape B — Cross-layer implementation with disjoint ownership

Use for:

- backend API + frontend page + tests, if file ownership is separate

Suggested team:

- backend implementer
- frontend implementer
- test implementer
- lead reviewer

## Do not use teams for

- same-file refactors
- DB schema + API + UI all tangled in one change set
- broad UI polish where shared component ownership overlaps
- runtime stack resolution work touching the same adapter files

## Plan-approval mode

For risky tasks, ask the lead to require plan approval before a teammate writes code. Use this for:

- DB schema changes
- auth / token changes
- hook / settings changes
- runtime React adapter changes

## Recommended kickoff prompt for the lead

"Create a build program for Compyl. Use focused subagents by default and only create an agent team when the task truly benefits from parallel work. Keep file ownership disjoint. Require plan approval before DB, auth, runtime adapter, or hook changes. Wait for teammates to finish before synthesizing."

## Example agent-team prompt

"Create an agent team to review this milestone from four angles: one on security/privacy boundaries, one on test coverage and Playwright risk, one on UI consistency against our system docs, and one on runtime stack-resolution correctness. Have them challenge each other’s findings and produce a merged action list."

## Hooks to use with teams

- `TeammateIdle`: keep teammates working if required evidence is missing
- `TaskCompleted`: prevent closure if tests or validation docs are missing

## Clean-up rule

Always shut down teammates through the lead and then ask the lead to clean up the team resources.
