---
name: validate-db-boundaries
description: Validate schema, tenancy, and trust boundaries before migrations or auth/permission changes merge.
context: fork
agent: db-foundation-engineer
allowed-tools: Read, Grep, Glob, Bash
---

Review $ARGUMENTS against `docs/04-db-and-boundaries.md` and `validation/api-and-schema.md`.

Reject changes that:

- blur reporter/team/agent boundaries
- remove rollback thinking from migrations
- expose developer-only fields to reviewer surfaces
- weaken token scopes or auditability
