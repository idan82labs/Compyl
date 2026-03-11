#!/usr/bin/env bash
set -euo pipefail
# TEAM-MODE ONLY. Not wired in settings.json by default (subagent model doesn't use TeammateIdle).
# Re-enable in settings.json only when running agent teams.
# Keep teammate working if they haven't updated progress or validation after touching code.
if [[ -f "progress.md" && -d "validation" ]]; then
  exit 0
fi
echo "Do not go idle yet. Update progress.md and validation artifacts before stopping." >&2
exit 2
