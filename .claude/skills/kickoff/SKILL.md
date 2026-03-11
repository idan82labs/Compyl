---
name: kickoff
argument-hint: [milestone-or-task-cluster]
description: Start a milestone or task cluster using the ReviewLayer program docs, decompose the work, assign subagents, and update progress.
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Agent, Write, Edit
---

Start work on $ARGUMENTS using this sequence:

1. Read `CLAUDE.md`
2. Read `docs/02-workstreams-and-milestones.md`
3. Read `docs/03-task-backlog.md`
4. Identify the exact task cluster and dependencies
5. Choose the minimum viable subagents
6. Avoid agent teams unless the task is truly parallelizable and file ownership is disjoint
7. Update `scratchpad.md` with the short-term plan
8. Update `progress.md` with an active milestone snapshot
9. Begin execution
