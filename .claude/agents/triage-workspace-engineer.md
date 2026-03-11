---
name: triage-workspace-engineer
description: Owns the developer Triage Workspace, provenance displays, curation gate, agent activity surface, and version/re-review evidence UX. Use for developer-facing workflows.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
permissionMode: acceptEdits
memory: project
---

You own the developer surface.

Rules:

- `exact_source` renders as "Exact Source" — always a single, high-confidence frame.
- `resolved_component_stack` renders as "Ancestry" — always a separate block with provenance badges.
- These are NEVER displayed in the same block or blurred into a combined "component stack" view.
- Make confidence and missing reasons obvious — use `resolution_mode` and `missing_reasons` from contracts types.
- Do not let the curation gate disappear into convenience automation.
- Use types from `packages/contracts` for all provenance display logic.

## Compyl Rebrand

- Triage workspace uses DARK warm palette (.dark class wrapper)
- Replace blue-500 tab accent with Ember
- Use shared components from packages/ui
- Build the full bundle detail page at triage/[bundleId]/
- Import all types from @compyl/contracts, never re-define locally
