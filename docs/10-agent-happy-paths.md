# Agent Happy Paths — Claude Code, Cursor, Codex

How AI coding agents integrate with Compyl via MCP and CLI.

## MCP Integration (Claude Code, Cursor)

### Configuration

Add to your MCP settings (e.g. `.claude/settings.json` or Cursor MCP config):

```json
{
  "mcpServers": {
    "reviewlayer": {
      "command": "npx",
      "args": ["reviewlayer-mcp"],
      "env": {
        "REVIEWLAYER_API_URL": "https://api.reviewlayer.io",
        "REVIEWLAYER_AGENT_TOKEN": "rl_agent_..."
      }
    }
  }
}
```

Or with explicit args:

```bash
reviewlayer-mcp --api-url https://api.reviewlayer.io --token rl_agent_...
```

### Available Tools (10)

| Tool | Type | Description |
|------|------|-------------|
| `list_bundles` | read | List ExecutionBundles for a project (filters: status, severity, category) |
| `get_bundle` | read | Get full bundle with provenance (exact_source + resolved_component_stack separate) |
| `update_bundle_status` | mutate | Change bundle status (requires readwrite/full token) |
| `assign_bundle` | mutate | Assign bundle to human or agent (requires readwrite/full token) |
| `propose_resolution` | mutate | Propose a fix with files changed + commit SHA (requires readwrite/full token) |
| `get_session` | read | Get review session details |
| `list_sessions` | read | List sessions for a project |
| `search_bundles` | read | Full-text search across bundles |
| `get_acceptance_criteria` | read | Get acceptance criteria and validation steps |
| `validate_bundle` | mutate | Submit validation results per step (requires readwrite/full token) |

### Available Resources (4)

| URI Template | Description |
|-------------|-------------|
| `reviewlayer://bundles/{bundleId}` | Single bundle |
| `reviewlayer://projects/{projectId}/bundles` | All project bundles |
| `reviewlayer://sessions/{sessionId}` | Session details |
| `reviewlayer://projects/{projectId}/sessions` | All project sessions |

### Token Scopes

| Scope | Read Tools | Mutate Tools |
|-------|-----------|-------------|
| `read` | All 6 | Denied (SCOPE_DENIED) |
| `readwrite` | All 6 | All 4 |
| `full` | All 6 | All 4 |

Denied actions emit audit events with `status: "denied"` and `error_code: "SCOPE_DENIED"`.

### Happy Path: Triage and Fix

```
1. list_bundles({ project_id, status: "pending_review" })
   → Get unresolved feedback items

2. get_bundle({ bundle_id })
   → Read exact_source, component_stack, acceptance_criteria

3. update_bundle_status({ bundle_id, status: "in_progress" })
   → Claim the item

4. [Agent implements fix in codebase]

5. propose_resolution({
     bundle_id,
     resolution_summary: "Fixed button overflow with max-width constraint",
     files_changed: ["src/components/Checkout/SubmitButton.tsx"],
     commit_sha: "abc123",
     pr_url: "https://github.com/org/repo/pull/42"
   })
   → Propose resolution (does NOT close — human review required)

6. validate_bundle({
     bundle_id,
     validation_results: [
       { step: "Button fits within 375px viewport", passed: true, evidence: "Screenshot attached" },
       { step: "No horizontal scroll on mobile", passed: true }
     ]
   })
   → Submit validation evidence
```

### Happy Path: Read-Only Analysis

```
1. list_bundles({ project_id, severity: "critical" })
   → Find critical issues

2. get_bundle({ bundle_id })
   → Examine provenance + design candidates

3. get_acceptance_criteria({ bundle_id })
   → Understand what needs to pass

4. search_bundles({ project_id, query: "button" })
   → Find related issues
```

## CLI Integration (Codex, shell-based agents)

### Installation

```bash
pnpm add @reviewlayer/cli
```

### Commands (7)

| Command | Type | Usage |
|---------|------|-------|
| `reviewlayer pull` | read | `reviewlayer pull --project <id>` |
| `reviewlayer bundle` | read | `reviewlayer bundle <id>` |
| `reviewlayer status` | mutate | `reviewlayer status <id> <status>` |
| `reviewlayer plan` | read | `reviewlayer plan <id>` |
| `reviewlayer push-result` | mutate | `reviewlayer push-result <id> --summary <text> --files <paths...>` |
| `reviewlayer validate` | mutate | `reviewlayer validate <id> --results <json>` |
| `reviewlayer diff` | read | `reviewlayer diff --project <id> --query <text>` |

### Happy Path: CLI Workflow

```bash
# 1. Pull pending bundles
reviewlayer pull --project proj-123

# 2. Read specific bundle
reviewlayer bundle bundle-456

# 3. Generate execution plan
reviewlayer plan bundle-456

# 4. Mark in progress
reviewlayer status bundle-456 in_progress

# 5. [Fix the issue]

# 6. Push resolution
reviewlayer push-result bundle-456 \
  --summary "Fixed overflow" \
  --files src/SubmitButton.tsx src/checkout.css

# 7. Submit validation
reviewlayer validate bundle-456 \
  --results '[{"step":"viewport test","passed":true}]'
```

## Audit Trail

Every MCP tool call and CLI command emits a structured `AgentAction` event:

```json
{
  "id": "uuid",
  "timestamp": "2026-03-11T10:00:00.000Z",
  "actor_type": "agent",
  "actor_id": "agent:rl_agent...",
  "source": "mcp",
  "action": "get_bundle",
  "payload": { "bundle_id": "bundle-456" },
  "target_entity_type": "bundle",
  "target_entity_id": "bundle-456",
  "status": "success",
  "duration_ms": 42,
  "project_id": "proj-123"
}
```

Visible in the Agent Activity tab (developer triage workspace) and queryable via `GET /api/v1/projects/:projectId/activity`.

## Architecture Rules for Agents

1. **Read/propose by default** — agents cannot close/resolve unless project policy explicitly enables it.
2. **Provenance is explicit** — `exact_source` (build-time) and `resolved_component_stack` (runtime) are always separate fields. Never merge them.
3. **Design candidates are ranked, not truth** — unless Code Connect provides identity resolution, `design_candidates` are honest-confidence suggestions.
4. **Immutable reporter fields** — agents cannot modify `summary`, `client_raw_text`, `reference_images`, `screenshot_url`.
5. **All actions audited** — every tool call/command produces an `AgentAction` event, including denied actions.
