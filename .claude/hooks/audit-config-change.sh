#!/usr/bin/env bash
set -euo pipefail
INPUT="$(cat)"
mkdir -p .claude/audit
printf '%s\n' "$INPUT" >> .claude/audit/config-changes.jsonl
exit 0
