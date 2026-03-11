"use client";

import { useEffect, useState } from "react";
import type {
  FeedbackCategory,
  Severity,
  ResolutionMode,
  BundleStatus,
} from "@reviewlayer/contracts";

// =============================================================================
// Developer bundle type — full technical context
// =============================================================================

interface DeveloperBundle {
  id: string;
  title: string;
  summary: string;
  normalized_task: string;
  category: FeedbackCategory;
  severity: Severity;
  page_url: string;
  screenshot_url: string | null;
  dom_selector: string;

  // Provenance — ALWAYS separate
  exact_source: {
    file_path: string;
    component_name: string;
    line: number;
    line_kind: "leaf-dom";
  } | null;
  resolved_component_stack: Array<{
    component_name: string;
    file_path?: string;
    line?: number;
    line_kind: string;
    is_library: boolean;
  }>;
  resolution_mode: ResolutionMode;
  missing_reasons: string[];
  root_boundary_kind: string | null;

  // Derived
  component_candidates: Array<{
    component_name: string;
    file_path?: string;
    confidence: number;
  }>;
  design_candidates: Array<{
    component_id: string;
    component_name: string;
    confidence: number;
    is_code_connect?: boolean;
    ranking_signals?: Array<{
      signal: string;
      weight: number;
      matched: boolean;
      detail?: string;
    }>;
  }>;

  design_diff: Record<string, unknown> | null;

  // AI-generated
  acceptance_criteria: string[];
  confidence: {
    component_match: number;
    design_match: number;
    task_clarity: number;
  };

  // Lifecycle
  status: BundleStatus;
  assignee_type: string;
  assignee_id: string | null;
  created_at: string;
}

// =============================================================================
// Labels
// =============================================================================

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  major: "bg-orange-100 text-orange-800",
  minor: "bg-yellow-100 text-yellow-800",
  suggestion: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const MODE_LABELS: Record<string, string> = {
  fiber_meta: "Fiber + Meta",
  server_prefix: "Server Prefix",
  leaf_only: "Leaf Only",
  heuristic: "Heuristic",
};

// =============================================================================
// Component
// =============================================================================

export function TriageList() {
  const [bundles, setBundles] = useState<DeveloperBundle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

    fetch(`${apiBase}/api/v1/bundles`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load bundles (${res.status})`);
        return res.json() as Promise<{ bundles: DeveloperBundle[] }>;
      })
      .then((data) => {
        setBundles(data.bundles);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-gray-500">Loading bundles...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700">
        {error}
      </div>
    );
  }

  if (bundles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center text-gray-500">
        <p className="text-lg font-medium">No bundles yet</p>
        <p className="mt-1 text-sm">
          Submit a review session to generate ExecutionBundles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bundles.map((bundle) => (
        <BundleRow key={bundle.id} bundle={bundle} />
      ))}
    </div>
  );
}

// =============================================================================
// Bundle row — developer view with provenance
// =============================================================================

function BundleRow({ bundle: initialBundle }: { bundle: DeveloperBundle }) {
  const [expanded, setExpanded] = useState(false);
  const [bundle, setBundle] = useState(initialBundle);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleStatusChange = async (newStatus: BundleStatus) => {
    setActionError(null);
    setActionLoading(true);
    try {
      const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
      const res = await fetch(`${apiBase}/api/v1/bundles/${bundle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setBundle({ ...bundle, status: newStatus });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <article className="rounded-lg border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 p-4 text-left hover:bg-gray-50"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{bundle.title}</h3>
            <span className={`rounded px-1.5 py-0.5 text-xs ${SEVERITY_COLORS[bundle.severity] ?? ""}`}>
              {bundle.severity}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[bundle.status] ?? ""}`}>
              {bundle.status.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{bundle.normalized_task}</p>
        </div>
        <div className="text-sm text-gray-400">
          {expanded ? "▲" : "▼"}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          {/* Curation Gate — status actions */}
          <CurationControls
            bundleId={bundle.id}
            status={bundle.status}
            onStatusChange={handleStatusChange}
            loading={actionLoading}
            error={actionError}
          />

          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* Left: Provenance */}
            <div>
              <ProvenanceSection bundle={bundle} />
            </div>
            {/* Right: Context */}
            <div>
              <ContextSection bundle={bundle} />
            </div>
          </div>

          {/* Design Candidates — developer-only */}
          {bundle.design_candidates && bundle.design_candidates.length > 0 && (
            <div className="mt-4">
              <DesignCandidatesSection candidates={bundle.design_candidates} />
            </div>
          )}

          {/* Before/After Comparison — developer-only */}
          {(bundle.screenshot_url || bundle.design_diff) && (
            <div className="mt-4">
              <BeforeAfterComparison bundle={bundle} />
            </div>
          )}

          {bundle.acceptance_criteria.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase text-gray-500">
                Acceptance Criteria
              </h4>
              <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
                {bundle.acceptance_criteria.map((criterion, i) => (
                  <li key={i}>{criterion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// =============================================================================
// Curation Gate — developer status transition controls
// =============================================================================

/** Valid next statuses from each current status. */
const TRANSITIONS: Record<BundleStatus, { status: BundleStatus; label: string; style: string }[]> = {
  pending_review: [
    { status: "approved", label: "Approve", style: "bg-blue-600 text-white hover:bg-blue-700" },
    { status: "rejected", label: "Reject", style: "bg-red-100 text-red-700 hover:bg-red-200" },
  ],
  approved: [
    { status: "in_progress", label: "Start Work", style: "bg-purple-600 text-white hover:bg-purple-700" },
    { status: "pending_review", label: "Return to Review", style: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  ],
  in_progress: [
    { status: "resolved", label: "Mark Resolved", style: "bg-green-600 text-white hover:bg-green-700" },
    { status: "approved", label: "Unblock", style: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
  ],
  resolved: [
    { status: "in_progress", label: "Reopen", style: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  ],
  rejected: [
    { status: "pending_review", label: "Reopen for Review", style: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" },
  ],
};

function CurationControls({
  bundleId: _bundleId,
  status,
  onStatusChange,
  loading,
  error,
}: {
  bundleId: string;
  status: BundleStatus;
  onStatusChange: (status: BundleStatus) => void;
  loading: boolean;
  error: string | null;
}) {
  const actions = TRANSITIONS[status] ?? [];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-500">Actions:</span>
      {actions.map((action) => (
        <button
          key={action.status}
          type="button"
          disabled={loading}
          onClick={() => onStatusChange(action.status)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${action.style}`}
        >
          {action.label}
        </button>
      ))}
      {loading && <span className="text-xs text-gray-400">Updating...</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

// =============================================================================
// Provenance section — exact_source SEPARATE from resolved_component_stack
// =============================================================================

function ProvenanceSection({ bundle }: { bundle: DeveloperBundle }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-gray-500">
        Provenance
        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500">
          {MODE_LABELS[bundle.resolution_mode] ?? bundle.resolution_mode}
        </span>
      </h4>

      {/* Exact Source — build-time, ALWAYS separate */}
      <div className="mt-2">
        <span className="text-xs font-medium text-gray-500">Exact Source</span>
        {bundle.exact_source ? (
          <div className="mt-0.5 rounded bg-blue-50 px-2 py-1 font-mono text-xs text-blue-800">
            {bundle.exact_source.component_name} —{" "}
            {bundle.exact_source.file_path}:{bundle.exact_source.line}
          </div>
        ) : (
          <div className="mt-0.5 text-xs italic text-gray-400">
            Not available
            {bundle.missing_reasons.length > 0 && (
              <span className="ml-1">
                ({bundle.missing_reasons.join(", ")})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Resolved Component Stack — runtime, ALWAYS separate */}
      <div className="mt-3">
        <span className="text-xs font-medium text-gray-500">
          Component Stack ({bundle.resolved_component_stack.length} frames)
        </span>
        {bundle.resolved_component_stack.length > 0 ? (
          <div className="mt-0.5 space-y-0.5">
            {bundle.resolved_component_stack.map((frame, i) => (
              <div
                key={i}
                className={`rounded px-2 py-0.5 font-mono text-xs ${
                  frame.is_library
                    ? "bg-gray-50 text-gray-500"
                    : "bg-green-50 text-green-800"
                }`}
              >
                {frame.component_name}
                {frame.file_path && (
                  <span className="ml-1 text-gray-400">
                    {frame.file_path}
                    {frame.line != null ? `:${frame.line}` : ""}
                  </span>
                )}
                {frame.is_library && (
                  <span className="ml-1 text-[10px] text-gray-400">(lib)</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-0.5 text-xs italic text-gray-400">
            No component stack resolved
          </div>
        )}
      </div>

      {/* Confidence scores */}
      <div className="mt-3">
        <span className="text-xs font-medium text-gray-500">Confidence</span>
        <div className="mt-0.5 flex gap-3 text-xs">
          <ConfidenceBar label="Component" value={bundle.confidence.component_match} />
          <ConfidenceBar label="Design" value={bundle.confidence.design_match} />
          <ConfidenceBar label="Clarity" value={bundle.confidence.task_clarity} />
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex-1">
      <div className="flex justify-between text-gray-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-0.5 h-1.5 rounded-full bg-gray-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// =============================================================================
// Context section — page, selector, candidates
// =============================================================================

// =============================================================================
// Design Candidates section — Figma component matches (developer-only)
// =============================================================================

function DesignCandidatesSection({
  candidates,
}: {
  candidates: DeveloperBundle["design_candidates"];
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-gray-500">
        Design Candidates
        <span className="ml-2 text-[10px] font-normal text-gray-400">
          Figma component matches
        </span>
      </h4>
      <div className="mt-1 space-y-1">
        {candidates.map((candidate, i) => (
          <div key={candidate.component_id} className="rounded border border-gray-100">
            <button
              type="button"
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-gray-50"
            >
              <span className="font-mono font-medium text-gray-800">
                {candidate.component_name}
              </span>
              {candidate.is_code_connect && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  Code Connect
                </span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <ConfidenceDot confidence={candidate.confidence} />
                <span className="text-gray-500">
                  {Math.round(candidate.confidence * 100)}%
                </span>
              </span>
              <span className="text-gray-400">
                {expandedIdx === i ? "▲" : "▼"}
              </span>
            </button>
            {expandedIdx === i && candidate.ranking_signals && (
              <div className="border-t border-gray-100 px-2 py-1.5">
                <span className="text-[10px] font-medium uppercase text-gray-400">
                  Ranking Signals
                </span>
                <div className="mt-1 space-y-0.5">
                  {candidate.ranking_signals.map((signal, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px]">
                      <span className={signal.matched ? "text-green-600" : "text-gray-400"}>
                        {signal.matched ? "+" : "-"}
                      </span>
                      <span className="font-mono text-gray-600">{signal.signal}</span>
                      {signal.detail && (
                        <span className="truncate text-gray-400">{signal.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.8
      ? "bg-green-500"
      : confidence >= 0.5
        ? "bg-yellow-500"
        : "bg-red-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

// =============================================================================
// Before/After Comparison — screenshot + design diff (developer-only)
// =============================================================================

function BeforeAfterComparison({ bundle }: { bundle: DeveloperBundle }) {
  const hasScreenshot = !!bundle.screenshot_url;
  const hasDiff = bundle.design_diff && Object.keys(bundle.design_diff).length > 0;
  const topDesignCandidate = bundle.design_candidates?.[0];
  const hasHighConfidenceMatch = topDesignCandidate && topDesignCandidate.confidence >= 0.6;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-gray-500">
        Before / After Comparison
      </h4>
      <div className="mt-2 grid grid-cols-2 gap-4">
        {/* Before: Current implementation (screenshot) */}
        <div>
          <span className="text-[10px] font-medium uppercase text-gray-400">Current (Before)</span>
          {hasScreenshot ? (
            <img
              src={bundle.screenshot_url!}
              alt="Current implementation screenshot"
              className="mt-1 max-h-48 rounded border border-gray-200"
            />
          ) : (
            <div className="mt-1 flex h-24 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">
              No screenshot captured
            </div>
          )}
        </div>

        {/* After: Design reference / diff */}
        <div>
          <span className="text-[10px] font-medium uppercase text-gray-400">Design Reference (After)</span>
          {hasHighConfidenceMatch ? (
            <div className="mt-1 rounded border border-gray-200 p-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-medium text-gray-800">
                  {topDesignCandidate.component_name}
                </span>
                {topDesignCandidate.is_code_connect && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">
                    Code Connect
                  </span>
                )}
                <span className="text-gray-500">
                  {Math.round(topDesignCandidate.confidence * 100)}% match
                </span>
              </div>
              {hasDiff ? (
                <div className="mt-2">
                  <span className="text-[10px] font-medium text-gray-500">Style Differences</span>
                  <div className="mt-1 space-y-0.5">
                    {Object.entries(bundle.design_diff!).map(([prop, value]) => (
                      <div key={prop} className="flex gap-2 font-mono text-[11px]">
                        <span className="text-red-600">{prop}:</span>
                        <span className="text-gray-700">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-gray-400">
                  No style differences computed yet
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 flex h-24 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">
              {topDesignCandidate
                ? `Low confidence match (${Math.round(topDesignCandidate.confidence * 100)}%) — diff not computed`
                : "No Figma design match available"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Context section — page, selector, candidates
// =============================================================================

function ContextSection({ bundle }: { bundle: DeveloperBundle }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-gray-500">Context</h4>

      <div className="mt-2 space-y-2 text-xs">
        <div>
          <span className="font-medium text-gray-500">Page: </span>
          <span className="text-gray-700">{bundle.page_url}</span>
        </div>
        <div>
          <span className="font-medium text-gray-500">Selector: </span>
          <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-700">
            {bundle.dom_selector}
          </code>
        </div>
        <div>
          <span className="font-medium text-gray-500">Category: </span>
          <span className="text-gray-700">{bundle.category}</span>
        </div>
      </div>

      {bundle.component_candidates.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-medium text-gray-500">
            Component Candidates
          </span>
          <div className="mt-0.5 space-y-0.5">
            {bundle.component_candidates.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-gray-700">{c.component_name}</span>
                {c.file_path && (
                  <span className="text-gray-400">{c.file_path}</span>
                )}
                <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-500">
                  {Math.round(c.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bundle.screenshot_url && (
        <div className="mt-3">
          <span className="text-xs font-medium text-gray-500">Screenshot</span>
          <img
            src={bundle.screenshot_url}
            alt="Screenshot"
            className="mt-1 max-h-32 rounded border"
          />
        </div>
      )}
    </div>
  );
}
