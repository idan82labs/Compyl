# 01 — Operating Model

## Recommended session structure

### Default

- 1 lead Claude Code session (`opus` alias)
- 4–8 focused subagents (`sonnet` by default)
- built-in `Explore` for fast read-only discovery

### Agent teams

Use agent teams only when all of these are true:

- tasks are parallelizable
- file ownership can be partitioned
- teammates need to exchange findings or challenge each other
- the lead can synthesize outcomes without same-file conflicts

Avoid agent teams for:

- same-file refactors
- sequential migrations
- fragile DB migration work
- UI polish on shared components

## Team composition for this project

- Lead architect / program driver
- Foundation / repo engineer
- DB boundary engineer
- App shell + design system engineer
- Annotation SDK engineer
- React runtime mapping engineer
- AI pipeline / ExecutionBundle engineer
- Reporter UX engineer
- Triage Workspace engineer
- Integrations engineer (GitHub / Figma / MCP / CLI)
- QA / Playwright engineer
- Security / privacy reviewer

## Work ownership rules

- One owner per task.
- One owning agent per file cluster.
- Same-file edits are serialized.
- DB schema changes require explicit plan approval before implementation.
- Hook and validation changes require separate review.

## Decision hygiene

Use this split:

- `scratchpad.md` = ephemeral
- `progress.md` = execution record
- `docs/*.md` = durable operating knowledge
- validation docs = merge gates / evidence records
