---
name: ui-consistency-check
description: Review changed UI against the Compyl design system, page consistency rules, and reporter/developer language boundaries.
context: fork
agent: design-system-engineer
allowed-tools: Read, Grep, Glob
---

Review the changed UI for $ARGUMENTS using `docs/05-ui-ux-system.md` and the relevant validation docs.

Output:

- inconsistencies found
- boundary leaks found
- fixes required before merge
- optional polish items
