"use client";

import { useEffect, useState } from "react";
import type {
  FeedbackCategory,
  Severity,
  ResolutionMode,
  BundleStatus,
} from "@compyl/contracts";
import {
  StatusBadge,
  SeverityBadge,
  ConfidenceDot,
  ProvenanceBadge,
  LoadingState,
  ErrorState,
  EmptyState,
  CodeBlock,
} from "@compyl/ui";

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
// Status mapping for StatusBadge (bundle statuses -> StatusBadge keys)
// =============================================================================

const BUNDLE_STATUS_MAP: Record<string, { status: string; label: string }> = {
  pending_review: { status: "pending", label: "Pending Review" },
  approved: { status: "approved", label: "Approved" },
  in_progress: { status: "in_progress", label: "In Progress" },
  resolved: { status: "resolved", label: "Resolved" },
  rejected: { status: "rejected", label: "Rejected" },
};

// =============================================================================
// Provenance mode mapping for ProvenanceBadge
// =============================================================================

const MODE_MAP: Record<string, { mode: string; label: string }> = {
  fiber_meta: { mode: "exact", label: "Fiber + Meta" },
  server_prefix: { mode: "ancestry", label: "Server Prefix" },
  leaf_only: { mode: "fallback", label: "Leaf Only" },
  heuristic: { mode: "heuristic", label: "Heuristic" },
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
    return <LoadingState message="Loading bundles..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (bundles.length === 0) {
    return (
      <EmptyState
        title="No bundles yet"
        description="Submit a review session to generate ExecutionBundles."
      />
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

  const statusMapping = BUNDLE_STATUS_MAP[bundle.status] ?? {
    status: bundle.status,
    label: bundle.status.replace(/_/g, " "),
  };

  return (
    <article className="rounded-lg border border-[var(--compyl-border)] shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 p-4 text-left hover:bg-[var(--compyl-surface)]"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-[var(--compyl-text)]">{bundle.title}</h3>
            <SeverityBadge severity={bundle.severity} />
            <StatusBadge
              status={statusMapping.status}
              label={statusMapping.label}
            />
          </div>
          <p className="mt-1 text-sm text-[var(--compyl-text-muted)]">{bundle.normalized_task}</p>
        </div>
        <div className="text-sm text-[var(--compyl-text-muted)]">
          {expanded ? "\u25B2" : "\u25BC"}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--compyl-border)] px-4 pb-4 pt-3">
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
              <h4 className="text-xs font-semibold uppercase text-[var(--compyl-text-muted)]">
                Acceptance Criteria
              </h4>
              <ul className="mt-1 list-disc pl-5 text-sm text-[var(--compyl-text)]">
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
    { status: "approved", label: "Approve", style: "bg-[var(--compyl-accent)] text-white hover:opacity-90" },
    { status: "rejected", label: "Reject", style: "bg-[var(--compyl-status-rejected-bg)] text-[var(--compyl-status-rejected-text)] hover:opacity-90" },
  ],
  approved: [
    { status: "in_progress", label: "Start Work", style: "bg-[var(--compyl-status-in-progress-bg)] text-[var(--compyl-status-in-progress-text)] hover:opacity-90" },
    { status: "pending_review", label: "Return to Review", style: "bg-[var(--compyl-surface)] text-[var(--compyl-text-muted)] hover:opacity-90" },
  ],
  in_progress: [
    { status: "resolved", label: "Mark Resolved", style: "bg-[var(--compyl-status-resolved-bg)] text-[var(--compyl-status-resolved-text)] hover:opacity-90" },
    { status: "approved", label: "Unblock", style: "bg-[var(--compyl-surface)] text-[var(--compyl-text-muted)] hover:opacity-90" },
  ],
  resolved: [
    { status: "in_progress", label: "Reopen", style: "bg-[var(--compyl-status-warning-bg)] text-[var(--compyl-status-warning-text)] hover:opacity-90" },
  ],
  rejected: [
    { status: "pending_review", label: "Reopen for Review", style: "bg-[var(--compyl-status-pending-bg)] text-[var(--compyl-status-pending-text)] hover:opacity-90" },
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
      <span className="text-xs font-medium text-[var(--compyl-text-muted)]">Actions:</span>
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
      {loading && <span className="text-xs text-[var(--compyl-text-muted)]">Updating...</span>}
      {error && <span className="text-xs text-[var(--compyl-status-error-text)]">{error}</span>}
    </div>
  );
}

// =============================================================================
// Provenance section — exact_source SEPARATE from resolved_component_stack
// =============================================================================

function ProvenanceSection({ bundle }: { bundle: DeveloperBundle }) {
  const modeMapping = MODE_MAP[bundle.resolution_mode] ?? {
    mode: bundle.resolution_mode,
    label: bundle.resolution_mode,
  };

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase text-[var(--compyl-text-muted)]">
        Provenance
        <span className="ml-2">
          <ProvenanceBadge mode={modeMapping.mode} label={modeMapping.label} />
        </span>
      </h4>

      {/* Exact Source — build-time, ALWAYS separate */}
      <div className="mt-2">
        <span className="text-xs font-medium text-[var(--compyl-text-muted)]">Exact Source</span>
        {bundle.exact_source ? (
          <div className="mt-0.5 rounded bg-[var(--compyl-accent-subtle)] px-2 py-1 font-mono text-xs text-[var(--compyl-accent)]">
            {bundle.exact_source.component_name} &mdash;{" "}
            {bundle.exact_source.file_path}:{bundle.exact_source.line}
          </div>
        ) : (
          <div className="mt-0.5 text-xs italic text-[var(--compyl-text-muted)]">
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
        <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
          Component Stack ({bundle.resolved_component_stack.length} frames)
        </span>
        {bundle.resolved_component_stack.length > 0 ? (
          <div className="mt-0.5 space-y-0.5">
            {bundle.resolved_component_stack.map((frame, i) => (
              <div
                key={i}
                className={`rounded px-2 py-0.5 font-mono text-xs ${
                  frame.is_library
                    ? "bg-[var(--compyl-surface)] text-[var(--compyl-text-muted)]"
                    : "bg-emerald-950/30 text-emerald-400"
                }`}
              >
                {frame.component_name}
                {frame.file_path && (
                  <span className="ml-1 text-[var(--compyl-text-muted)]">
                    {frame.file_path}
                    {frame.line != null ? `:${frame.line}` : ""}
                  </span>
                )}
                {frame.is_library && (
                  <span className="ml-1 text-[10px] text-[var(--compyl-text-muted)]">(lib)</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-0.5 text-xs italic text-[var(--compyl-text-muted)]">
            No component stack resolved
          </div>
        )}
      </div>

      {/* Confidence scores */}
      <div className="mt-3">
        <span className="text-xs font-medium text-[var(--compyl-text-muted)]">Confidence</span>
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
  const color =
    pct >= 70
      ? "bg-[var(--compyl-confidence-high)]"
      : pct >= 40
        ? "bg-[var(--compyl-confidence-medium)]"
        : "bg-[var(--compyl-confidence-low)]";
  return (
    <div className="flex-1">
      <div className="flex justify-between text-[var(--compyl-text-muted)]">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-0.5 h-1.5 rounded-full bg-[var(--compyl-surface)]">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
      <h4 className="text-xs font-semibold uppercase text-[var(--compyl-text-muted)]">
        Design Candidates
        <span className="ml-2 text-[10px] font-normal text-[var(--compyl-text-muted)]">
          Figma component matches
        </span>
      </h4>
      <div className="mt-1 space-y-1">
        {candidates.map((candidate, i) => (
          <div key={candidate.component_id} className="rounded border border-[var(--compyl-border)]">
            <button
              type="button"
              onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--compyl-surface)]"
            >
              <span className="font-mono font-medium text-[var(--compyl-text)]">
                {candidate.component_name}
              </span>
              {candidate.is_code_connect && (
                <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  Code Connect
                </span>
              )}
              <span className="ml-auto flex items-center gap-1">
                <ConfidenceDot value={candidate.confidence} />
                <span className="text-[var(--compyl-text-muted)]">
                  {Math.round(candidate.confidence * 100)}%
                </span>
              </span>
              <span className="text-[var(--compyl-text-muted)]">
                {expandedIdx === i ? "\u25B2" : "\u25BC"}
              </span>
            </button>
            {expandedIdx === i && candidate.ranking_signals && (
              <div className="border-t border-[var(--compyl-border)] px-2 py-1.5">
                <span className="text-[10px] font-medium uppercase text-[var(--compyl-text-muted)]">
                  Ranking Signals
                </span>
                <div className="mt-1 space-y-0.5">
                  {candidate.ranking_signals.map((signal, j) => (
                    <div key={j} className="flex items-center gap-2 text-[11px]">
                      <span className={signal.matched ? "text-[var(--compyl-confidence-high)]" : "text-[var(--compyl-text-muted)]"}>
                        {signal.matched ? "+" : "-"}
                      </span>
                      <span className="font-mono text-[var(--compyl-text)]">{signal.signal}</span>
                      {signal.detail && (
                        <span className="truncate text-[var(--compyl-text-muted)]">{signal.detail}</span>
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
      <h4 className="text-xs font-semibold uppercase text-[var(--compyl-text-muted)]">
        Before / After Comparison
      </h4>
      <div className="mt-2 grid grid-cols-2 gap-4">
        {/* Before: Current implementation (screenshot) */}
        <div>
          <span className="text-[10px] font-medium uppercase text-[var(--compyl-text-muted)]">Current (Before)</span>
          {hasScreenshot ? (
            <img
              src={bundle.screenshot_url!}
              alt="Current implementation screenshot"
              className="mt-1 max-h-48 rounded border border-[var(--compyl-border)]"
            />
          ) : (
            <div className="mt-1 flex h-24 items-center justify-center rounded border border-dashed border-[var(--compyl-border)] text-xs text-[var(--compyl-text-muted)]">
              No screenshot captured
            </div>
          )}
        </div>

        {/* After: Design reference / diff */}
        <div>
          <span className="text-[10px] font-medium uppercase text-[var(--compyl-text-muted)]">Design Reference (After)</span>
          {hasHighConfidenceMatch ? (
            <div className="mt-1 rounded border border-[var(--compyl-border)] p-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-medium text-[var(--compyl-text)]">
                  {topDesignCandidate.component_name}
                </span>
                {topDesignCandidate.is_code_connect && (
                  <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-400">
                    Code Connect
                  </span>
                )}
                <span className="text-[var(--compyl-text-muted)]">
                  {Math.round(topDesignCandidate.confidence * 100)}% match
                </span>
              </div>
              {hasDiff ? (
                <div className="mt-2">
                  <span className="text-[10px] font-medium text-[var(--compyl-text-muted)]">Style Differences</span>
                  <CodeBlock language="diff">
                    {Object.entries(bundle.design_diff!).map(([prop, value]) =>
                      `${prop}: ${String(value)}`
                    ).join("\n")}
                  </CodeBlock>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-[var(--compyl-text-muted)]">
                  No style differences computed yet
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 flex h-24 items-center justify-center rounded border border-dashed border-[var(--compyl-border)] text-xs text-[var(--compyl-text-muted)]">
              {topDesignCandidate
                ? `Low confidence match (${Math.round(topDesignCandidate.confidence * 100)}%) \u2014 diff not computed`
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
      <h4 className="text-xs font-semibold uppercase text-[var(--compyl-text-muted)]">Context</h4>

      <div className="mt-2 space-y-2 text-xs">
        <div>
          <span className="font-medium text-[var(--compyl-text-muted)]">Page: </span>
          <span className="text-[var(--compyl-text)]">{bundle.page_url}</span>
        </div>
        <div>
          <span className="font-medium text-[var(--compyl-text-muted)]">Selector: </span>
          <code className="rounded bg-[var(--compyl-surface)] px-1 py-0.5 text-[var(--compyl-text)]">
            {bundle.dom_selector}
          </code>
        </div>
        <div>
          <span className="font-medium text-[var(--compyl-text-muted)]">Category: </span>
          <span className="text-[var(--compyl-text)]">{bundle.category}</span>
        </div>
      </div>

      {bundle.component_candidates.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
            Component Candidates
          </span>
          <div className="mt-0.5 space-y-0.5">
            {bundle.component_candidates.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-[var(--compyl-text)]">{c.component_name}</span>
                {c.file_path && (
                  <span className="text-[var(--compyl-text-muted)]">{c.file_path}</span>
                )}
                <span className="rounded bg-[var(--compyl-surface)] px-1 py-0.5 text-[var(--compyl-text-muted)]">
                  {Math.round(c.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bundle.screenshot_url && (
        <div className="mt-3">
          <span className="text-xs font-medium text-[var(--compyl-text-muted)]">Screenshot</span>
          <img
            src={bundle.screenshot_url}
            alt="Screenshot"
            className="mt-1 max-h-32 rounded border border-[var(--compyl-border)]"
          />
        </div>
      )}
    </div>
  );
}
