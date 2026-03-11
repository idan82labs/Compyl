"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  AgentAction,
  AgentActionSource,
  AgentActorType,
  AgentActionStatus,
  ActivityQueryResponse,
} from "@reviewlayer/contracts";

// =============================================================================
// Labels / colors
// =============================================================================

const SOURCE_COLORS: Record<string, string> = {
  mcp: "bg-purple-100 text-purple-800",
  cli: "bg-blue-100 text-blue-800",
  api: "bg-green-100 text-green-800",
  ui: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  denied: "bg-yellow-100 text-yellow-800",
};

const ACTOR_LABELS: Record<string, string> = {
  agent: "Agent",
  human: "Human",
  system: "System",
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
      {loading && (
        <div className="py-12 text-center text-gray-500">Loading activity...</div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && actions.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center text-gray-500">
          <p className="text-lg font-medium">No agent activity</p>
          <p className="mt-1 text-sm">
            Actions from MCP tools and CLI commands will appear here.
          </p>
        </div>
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
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded border px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="rounded border px-3 py-1 disabled:opacity-40"
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

  return (
    <article className="rounded-lg border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-gray-50"
      >
        {/* Timestamp */}
        <div className="w-24 shrink-0 text-xs text-gray-400">
          <div>{dateStr}</div>
          <div>{timeStr}</div>
        </div>

        {/* Source badge */}
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${SOURCE_COLORS[action.source] ?? "bg-gray-100"}`}>
          {action.source}
        </span>

        {/* Action name */}
        <span className="font-mono font-medium text-gray-800">
          {action.action}
        </span>

        {/* Target */}
        {action.target_entity_type && (
          <span className="text-xs text-gray-400">
            on {action.target_entity_type}
            {action.target_entity_id && (
              <span className="ml-1 font-mono">{action.target_entity_id.slice(0, 8)}</span>
            )}
          </span>
        )}

        {/* Status */}
        <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[action.status] ?? ""}`}>
          {action.status}
        </span>

        {/* Duration */}
        <span className="w-16 shrink-0 text-right text-xs text-gray-400">
          {action.duration_ms}ms
        </span>

        {/* Expand toggle */}
        <span className="text-gray-300">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 text-xs">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <DetailRow label="Actor" value={`${ACTOR_LABELS[action.actor_type] ?? action.actor_type}${action.actor_id ? ` (${action.actor_id})` : ""}`} />
            <DetailRow label="Source" value={action.source} />
            <DetailRow label="Target" value={action.target_entity_type ? `${action.target_entity_type} / ${action.target_entity_id ?? "—"}` : "—"} />
            <DetailRow label="Duration" value={`${action.duration_ms}ms`} />
            {action.request_id && <DetailRow label="Request ID" value={action.request_id} />}
            {action.job_id && <DetailRow label="Job ID" value={action.job_id} />}
            {action.session_id && <DetailRow label="Session ID" value={action.session_id} />}
            {action.project_id && <DetailRow label="Project ID" value={action.project_id} />}
          </div>

          {action.status === "error" && (action.error_code || action.error_message) && (
            <div className="mt-2 rounded bg-red-50 px-2 py-1 text-red-700">
              {action.error_code && <span className="font-mono font-medium">{action.error_code}: </span>}
              {action.error_message}
            </div>
          )}

          {Object.keys(action.payload).length > 0 && (
            <div className="mt-2">
              <span className="font-medium text-gray-500">Payload</span>
              <pre className="mt-0.5 overflow-x-auto rounded bg-gray-50 p-2 font-mono text-[11px] text-gray-600">
                {JSON.stringify(action.payload, null, 2)}
              </pre>
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
      <span className="font-medium text-gray-500">{label}: </span>
      <span className="text-gray-700">{value}</span>
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
    <label className="flex items-center gap-1 text-xs text-gray-600">
      {label}:
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-xs"
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
