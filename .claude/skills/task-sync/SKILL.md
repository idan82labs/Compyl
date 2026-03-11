---
name: task-sync
description: Update progress.md, scratchpad.md, and the relevant validation docs after a completed task cluster.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob
---

Synchronize the execution state after finishing $ARGUMENTS.

Checklist:

- append a concise entry to `progress.md`
- prune or update `scratchpad.md`
- update any touched validation docs with evidence or explicit gaps
- note follow-up tasks and blockers
