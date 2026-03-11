---
name: validate-runtime-stack
description: Validate the v8 runtime stack-resolution architecture and reject fake build-time ancestry claims.
context: fork
agent: runtime-mapping-engineer
allowed-tools: Read, Grep, Glob, Bash
---

Validate $ARGUMENTS against `docs/08-runtime-stack-resolution.md` and `validation/runtime-stack-resolution.md`.

Must check:

- no fake build-time `data-rl-stack`
- exact source vs ancestry split
- provenance fields serialized honestly
- adapter failure modes handled safely
