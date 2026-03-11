"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  AgentAction,
  AgentActionSource,
  AgentActorType,
  AgentActionStatus,
  ActivityQueryResponse,
} from "@compyl/contracts";
import {
  SourceBadge,
  StatusBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  CodeBlock,
} from "@compyl/ui";

// =============================================================================
// Labels
// =============================================================================

const ACTOR_LABELS: Record<string, string> = {
  agent: "Agent",
  human: "Human",
  system: "System",
};

/** Map activity statuses to StatusBadge keys */
const ACTIVITY_STATUS_MAP: Record<string, { status: string; label: string }> = {
  success: { status: "success", label: "Success" },
  error: { status: "error", label: "Error" },
  denied: { status: "warning", label: "Denied" },
};

// =============================================================================
// Component
// =============================================================================

export function ActivityTab({ projectId }: { projectId: string }) {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters
  const [sourceFilter, setSourceFilter] = useState<AgentActionSource | "">("");
  const [actorFilter, setActorFilter] = useState<AgentActorType | "">("");
  const [statusFilter, setStatusFilter] = useState<AgentActionStatus | "">("");

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);

    const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (sourceFilter) params.set("source", sourceFilter);
    if (actorFilter) params.set("actor_type", actorFilter);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(
        `${apiBase}/api/v1/projects/${projectId}/activity?${params.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to load activity (${res.status})`);
      const data = (await res.json()) as ActivityQueryResponse;
      setActions(data.actions);
      setTotal(data.total);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, offset, sourceFilter, actorFilter, statusFilter]);

  useEffect(() => {
    void fetchActions();
  }, [fetchActions]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [sourceFilter, actorFilter, statusFilter]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <FilterSelect
          label="Source"
          value={sourceFilter}
          options={["mcp", "cli", "api", "ui"]}
          onChange={(v) => setSourceFilter(v as AgentActionSource | "")}
        />
        <FilterSelect
          label="Actor"
          value={actorFilter}
          options={["agent", "human", "system"]}
          onChange={(v) => setActorFilter(v as AgentActorType | "")}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          options={["success", "error", "denied"]}
          onChange={(v) => setStatusFilter(v as AgentActionStatus | "")}
        />
      </div>

      {/* Loading */}
      {loading && <LoadingState message="Loading activity..." />}

      {/* Error */}
      {error && <ErrorState message={error} onRetry={fetchActions} />}

      {/* Empty state */}
      {!loading && !error && actions.length === 0 && (
        <EmptyState
          title="No agent activity"
          description="Actions from MCP tools and CLI commands will appear here."
        />
      )}

      {/* Action list */}
      {!loading && !error && actions.length > 0 && (
        <>
          <div className="space-y-2">
            {actions.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--compyl-text-muted)]">
            <span>
              Showing {offset + 1}&ndash;{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded border border-[var(--compyl-border)] bg-[var(--compyl-surface)] px-3 py-1 text-[var(--compyl-text)] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="rounded border border-[var(--compyl-border)] bg-[var(--compyl-surface)] px-3 py-1 text-[var(--compyl-text)] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Action row
// =============================================================================

function ActionRow({ action }: { action: AgentAction }) {
  const [expanded, setExpanded] = useState(false);
  const ts = new Date(action.timestamp);
  const timeStr = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = ts.toLocaleDateString([], { month: "short", day: "numeric" });

  const statusMapping = ACTIVITY_STATUS_MAP[action.status] ?? {
    status: action.status,
    label: action.status,
  };

  return (
    <article className="rounded-lg border border-[var(--compyl-border)] shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-[var(--compyl-surface)]"
      >
        {/* Timestamp */}
        <div className="w-24 shrink-0 text-xs text-[var(--compyl-text-muted)]">
          <div>{dateStr}</div>
          <div>{timeStr}</div>
        </div>

        {/* Source badge */}
        <SourceBadge source={action.source} />

        {/* Action name */}
        <span className="font-mono font-medium text-[var(--compyl-text)]">
          {action.action}
        </span>

        {/* Target */}
        {action.target_entity_type && (
          <span className="text-xs text-[var(--compyl-text-muted)]">
            on {action.target_entity_type}
            {action.target_entity_id && (
              <span className="ml-1 font-mono">{action.target_entity_id.slice(0, 8)}</span>
            )}
          </span>
        )}

        {/* Status */}
        <span className="ml-auto shrink-0">
          <StatusBadge
            status={statusMapping.status}
            label={statusMapping.label}
          />
        </span>

        {/* Duration */}
        <span className="w-16 shrink-0 text-right text-xs text-[var(--compyl-text-muted)]">
          {action.duration_ms}ms
        </span>

        {/* Expand toggle */}
        <span className="text-[var(--compyl-text-muted)]">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--compyl-border)] px-3 pb-3 pt-2 text-xs">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <DetailRow label="Actor" value={`${ACTOR_LABELS[action.actor_type] ?? action.actor_type}${action.actor_id ? ` (${action.actor_id})` : ""}`} />
            <DetailRow label="Source" value={action.source} />
            <DetailRow label="Target" value={action.target_entity_type ? `${action.target_entity_type} / ${action.target_entity_id ?? "\u2014"}` : "\u2014"} />
            <DetailRow label="Duration" value={`${action.duration_ms}ms`} />
            {action.request_id && <DetailRow label="Request ID" value={action.request_id} />}
            {action.job_id && <DetailRow label="Job ID" value={action.job_id} />}
            {action.session_id && <DetailRow label="Session ID" value={action.session_id} />}
            {action.project_id && <DetailRow label="Project ID" value={action.project_id} />}
          </div>

          {action.status === "error" && (action.error_code || action.error_message) && (
            <div className="mt-2 rounded bg-[var(--compyl-status-error-bg)] px-2 py-1 text-[var(--compyl-status-error-text)]">
              {action.error_code && <span className="font-mono font-medium">{action.error_code}: </span>}
              {action.error_message}
            </div>
          )}

          {Object.keys(action.payload).length > 0 && (
            <div className="mt-2">
              <span className="font-medium text-[var(--compyl-text-muted)]">Payload</span>
              <CodeBlock language="json">
                {JSON.stringify(action.payload, null, 2)}
              </CodeBlock>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-[var(--compyl-text-muted)]">{label}: </span>
      <span className="text-[var(--compyl-text)]">{value}</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-[var(--compyl-text-muted)]">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[var(--compyl-border)] bg-[var(--compyl-surface)] px-2 py-1 text-xs text-[var(--compyl-text)]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
