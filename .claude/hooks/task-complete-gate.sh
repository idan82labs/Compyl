#!/usr/bin/env bash
set -euo pipefail
INPUT="$(cat)"
TASK_SUBJECT="$(printf '%s' "$INPUT" | jq -r '.task_subject // ""')"
if [[ ! -f "progress.md" ]]; then
  echo "progress.md missing; update progress before closing task" >&2
  exit 2
fi
if [[ ! -d "validation" ]]; then
  echo "validation/ directory missing" >&2
  exit 2
fi
# Light-touch gate: require at least one modified validation doc or explicit note.
if ! grep -Rqi "Evidence" validation 2>/dev/null; then
  echo "Validation docs appear uninitialized. Add evidence or note why validation is deferred before completing: $TASK_SUBJECT" >&2
  exit 2
fi
exit 0
