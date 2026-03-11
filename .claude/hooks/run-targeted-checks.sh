#!/usr/bin/env bash
set -euo pipefail
INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

case "$FILE_PATH" in
  *.tsx|*.ts|*.jsx|*.js)
    if command -v pnpm >/dev/null 2>&1; then
      pnpm lint >/tmp/compyl-lint.log 2>&1 || true
      pnpm typecheck >/tmp/compyl-typecheck.log 2>&1 || true
      echo '{"systemMessage":"Targeted post-edit checks finished. Review lint/typecheck output if failures persist."}'
    fi
    ;;
  *)
    exit 0
    ;;
esac
