"use client";

import { useEffect, useState } from "react";
import type {
  BundleStatus,
  FeedbackCategory,
  ResolutionMode,
  Severity,
} from "@reviewlayer/contracts";
import {
  CodeBlock,
  ConfidenceDot,
  ErrorState,
  LoadingState,
  ProvenanceBadge,
  SeverityBadge,
  StatusBadge,
} from "@reviewlayer/ui";

// =============================================================================
// Developer bundle type — full technical context (matches triage-list shape)
// =============================================================================

interface DeveloperBundle {
  id: string;
  title: string;
  summary: string;
  normalized_task: string;
  category: FeedbackCategory;
  severity: Severity;
  page_url: string;
  viewport?: {
    width: number;
    height: number;
    scroll_x: number;
    scroll_y: number;
    device_preset?: string;
    css_breakpoint?: string;
  };
  screenshot_url: string | null;
  dom_selector: string;
  client_raw_text?: string;

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
// Status mapping for StatusBadge
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
// Status transitions (same as triage-list)
// =============================================================================

const TRANSITIONS: Record<
  BundleStatus,
  { status: BundleStatus; label: string; style: string }[]
> = {
  pending_review: [
    {
      status: "approved",
      label: "Approve",
      style:
        "bg-[var(--compyl-accent)] text-white hover:opacity-90",
    },
    {
      status: "rejected",
      label: "Reject",
      style:
        "bg-[var(--compyl-status-rejected-bg)] text-[var(--compyl-status-rejected-text)] hover:opacity-90",
    },
  ],
  approved: [
    {
      status: "in_progress",
      label: "Start Work",
      style:
        "bg-[var(--compyl-status-in-progress-bg)] text-[var(--compyl-status-in-progress-text)] hover:opacity-90",
    },
    {
      status: "pending_review",
      label: "Return to Review",
      style:
        "bg-[var(--compyl-surface)] text-[var(--compyl-text-muted)] hover:opacity-90",
    },
  ],
  in_progress: [
    {
      status: "resolved",
      label: "Mark Resolved",
      style:
        "bg-[var(--compyl-status-resolved-bg)] text-[var(--compyl-status-resolved-text)] hover:opacity-90",
    },
    {
      status: "approved",
      label: "Unblock",
      style:
        "bg-[var(--compyl-surface)] text-[var(--compyl-text-muted)] hover:opacity-90",
    },
  ],
  resolved: [
    {
      status: "in_progress",
      label: "Reopen",
      style:
        "bg-[var(--compyl-status-warning-bg)] text-[var(--compyl-status-warning-text)] hover:opacity-90",
    },
  ],
  rejected: [
    {
      status: "pending_review",
      label: "Reopen for Review",
      style:
        "bg-[var(--compyl-status-pending-bg)] text-[var(--compyl-status-pending-text)] hover:opacity-90",
    },
  ],
};

// =============================================================================
// BundleDetail — main client component
// =============================================================================

export function BundleDetail({ bundleId }: { bundleId: string }) {
  const [bundle, setBundle] = useState<DeveloperBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const apiBase =
      process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

    fetch(`${apiBase}/api/v1/bundles/${bundleId}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok)
          throw new Error(`Failed to load bundle (${res.status})`);
        return res.json() as Promise<DeveloperBundle>;
      })
      .then((data) => {
        setBundle(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [bundleId]);

  const handleStatusChange = async (newStatus: BundleStatus) => {
    if (!bundle) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const apiBase =
        process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
      const res = await fetch(`${apiBase}/api/v1/bundles/${bundle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(
          (err as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }
      setBundle({ ...bundle, status: newStatus });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading bundle..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!bundle) {
    return <ErrorState message="Bundle not found." />;
  }

  const statusMapping = BUNDLE_STATUS_MAP[bundle.status] ?? {
    status: bundle.status,
    label: bundle.status.replace(/_/g, " "),
  };

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* 1. Header */}
      {/* ================================================================= */}
      <section className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[var(--compyl-text)]">
            {bundle.title}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge
              status={statusMapping.status}
              label={statusMapping.label}
            />
            <SeverityBadge severity={bundle.severity} />
          </div>
        </div>
        <button
          type="button"
          className="rounded-md bg-[var(--compyl-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Dispatch to Agent
        </button>
      </section>

      {/* ================================================================= */}
      {/* 2. Human Context */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
          Human Context
        </h3>

        {bundle.client_raw_text && (
          <div className="mt-4">
            <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
              Reporter Quote
            </span>
            <blockquote className="mt-1 border-l-2 border-[var(--compyl-accent)] pl-3 text-sm italic text-[var(--compyl-text)]">
              &ldquo;{bundle.client_raw_text}&rdquo;
            </blockquote>
          </div>
        )}

        <div className="mt-4">
          <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
            AI Summary
          </span>
          <p className="mt-1 text-sm text-[var(--compyl-text)]">
            {bundle.summary}
          </p>
        </div>

        <div className="mt-4">
          <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
            Normalized Task
          </span>
          <p className="mt-1 rounded bg-[var(--compyl-bg)] px-3 py-2 font-mono text-sm text-[var(--compyl-text)]">
            {bundle.normalized_task}
          </p>
        </div>
      </section>

      {/* ================================================================= */}
      {/* 3. Design Delta */}
      {/* ================================================================= */}
      {bundle.design_diff &&
        Object.keys(bundle.design_diff).length > 0 && (
          <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
              Design Delta
            </h3>
            <div className="mt-4">
              <CodeBlock language="diff">
                {Object.entries(bundle.design_diff)
                  .map(([prop, value]) => {
                    if (
                      value &&
                      typeof value === "object" &&
                      "old" in (value as Record<string, unknown>) &&
                      "new" in (value as Record<string, unknown>)
                    ) {
                      const v = value as { old: unknown; new: unknown };
                      return `- ${prop}: ${String(v.old)}\n+ ${prop}: ${String(v.new)}`;
                    }
                    return `  ${prop}: ${String(value)}`;
                  })
                  .join("\n")}
              </CodeBlock>
            </div>
          </section>
        )}

      {/* ================================================================= */}
      {/* 4. Exact Source — SEPARATE block (critical architectural rule) */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
          Exact Source
          <span className="ml-2 text-xs font-normal normal-case tracking-normal">
            (build-time, single frame)
          </span>
        </h3>

        {bundle.exact_source ? (
          <div className="mt-4 rounded-md bg-[var(--compyl-accent-subtle)] px-4 py-3">
            <div className="font-mono text-sm font-medium text-[var(--compyl-accent)]">
              {bundle.exact_source.component_name}
            </div>
            <div className="mt-1 font-mono text-xs text-[var(--compyl-text-muted)]">
              {bundle.exact_source.file_path}:{bundle.exact_source.line}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm italic text-[var(--compyl-text-muted)]">
            Not available
            {bundle.missing_reasons.length > 0 && (
              <span className="ml-1">
                ({bundle.missing_reasons.join(", ")})
              </span>
            )}
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* 5. Resolved Ancestry — SEPARATE block (critical) */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
          Component Stack
          <span className="ml-2 text-xs font-normal normal-case tracking-normal">
            ({bundle.resolved_component_stack.length} frames)
          </span>
        </h3>

        {bundle.resolved_component_stack.length > 0 ? (
          <div className="relative mt-4 ml-4">
            {/* Vertical connector line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--compyl-border)]" />

            <div className="space-y-2">
              {bundle.resolved_component_stack.map((frame, i) => (
                <div key={i} className="relative pl-6">
                  {/* Node dot on the connector line */}
                  <div
                    className={`absolute left-[-4px] top-3 h-2 w-2 rounded-full ${
                      frame.is_library
                        ? "bg-[var(--compyl-text-muted)]"
                        : "bg-emerald-400"
                    }`}
                  />
                  <div
                    className={`rounded-md border px-4 py-2 ${
                      frame.is_library
                        ? "border-[var(--compyl-border)] bg-[var(--compyl-bg)] opacity-60"
                        : "border-emerald-800/40 bg-emerald-950/30"
                    }`}
                  >
                    <div
                      className={`font-mono text-sm font-medium ${
                        frame.is_library
                          ? "text-[var(--compyl-text-muted)]"
                          : "text-emerald-400"
                      }`}
                    >
                      {frame.component_name}
                      {frame.is_library && (
                        <span className="ml-2 text-[10px] font-normal">
                          (lib)
                        </span>
                      )}
                    </div>
                    {frame.file_path && (
                      <div className="mt-0.5 font-mono text-xs text-[var(--compyl-text-muted)]">
                        {frame.file_path}
                        {frame.line != null ? `:${frame.line}` : ""}
                      </div>
                    )}
                    <div className="mt-0.5 text-[10px] text-[var(--compyl-text-muted)]">
                      {frame.line_kind}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm italic text-[var(--compyl-text-muted)]">
            No component stack resolved
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* 6. Resolution Metadata */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
          Resolution Metadata
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div>
            <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
              Resolution Mode
            </span>
            <div className="mt-1">
              <ProvenanceBadge
                mode={
                  (MODE_MAP[bundle.resolution_mode]?.mode ??
                    bundle.resolution_mode)
                }
                label={
                  (MODE_MAP[bundle.resolution_mode]?.label ??
                    bundle.resolution_mode)
                }
              />
            </div>
          </div>

          {bundle.root_boundary_kind && (
            <div>
              <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
                Root Boundary
              </span>
              <div className="mt-1 rounded bg-[var(--compyl-bg)] px-2 py-1 font-mono text-xs text-[var(--compyl-text)]">
                {bundle.root_boundary_kind}
              </div>
            </div>
          )}
        </div>

        {bundle.missing_reasons.length > 0 && (
          <div className="mt-4">
            <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
              Missing Reasons
            </span>
            <ul className="mt-1 list-disc pl-5 text-sm text-[var(--compyl-text)]">
              {bundle.missing_reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* 7. Design Candidates */}
      {/* ================================================================= */}
      {bundle.design_candidates && bundle.design_candidates.length > 0 && (
        <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
            Design Candidates
            <span className="ml-2 text-xs font-normal normal-case tracking-normal text-[var(--compyl-text-muted)]">
              Figma component matches
            </span>
          </h3>
          <div className="mt-4 space-y-2">
            {bundle.design_candidates.map((candidate) => (
              <DesignCandidateCard
                key={candidate.component_id}
                candidate={candidate}
              />
            ))}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* 8. Confidence Model */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
          Confidence Model
        </h3>
        <div className="mt-4 flex gap-4">
          <ConfidenceBar
            label="Component"
            value={bundle.confidence.component_match}
          />
          <ConfidenceBar
            label="Design"
            value={bundle.confidence.design_match}
          />
          <ConfidenceBar
            label="Clarity"
            value={bundle.confidence.task_clarity}
          />
        </div>
      </section>

      {/* ================================================================= */}
      {/* 9. Acceptance Criteria */}
      {/* ================================================================= */}
      {bundle.acceptance_criteria.length > 0 && (
        <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
            Acceptance Criteria
          </h3>
          <ol className="mt-4 list-decimal pl-5 text-sm text-[var(--compyl-text)]">
            {bundle.acceptance_criteria.map((criterion, i) => (
              <li key={i} className="py-0.5">
                {criterion}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ================================================================= */}
      {/* 10. Curation Gate */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
          Curation Gate
        </h3>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--compyl-text-muted)]">
            Actions:
          </span>
          {(TRANSITIONS[bundle.status] ?? []).map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={actionLoading}
              onClick={() => handleStatusChange(action.status)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${action.style}`}
            >
              {action.label}
            </button>
          ))}
          {actionLoading && (
            <span className="text-xs text-[var(--compyl-text-muted)]">
              Updating...
            </span>
          )}
          {actionError && (
            <span className="text-xs text-[var(--compyl-status-error-text)]">
              {actionError}
            </span>
          )}
        </div>
      </section>

      {/* ================================================================= */}
      {/* 11. Context */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-[var(--compyl-border)] bg-[var(--compyl-surface)] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--compyl-text-muted)]">
          Context
        </h3>
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <span className="font-medium text-[var(--compyl-text-muted)]">
              Page URL:{" "}
            </span>
            <a
              href={bundle.page_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--compyl-accent)] hover:underline"
            >
              {bundle.page_url}
            </a>
          </div>
          {bundle.viewport && (
            <div>
              <span className="font-medium text-[var(--compyl-text-muted)]">
                Viewport:{" "}
              </span>
              <span className="text-[var(--compyl-text)]">
                {bundle.viewport.width}x{bundle.viewport.height}
                {bundle.viewport.device_preset &&
                  ` (${bundle.viewport.device_preset})`}
              </span>
            </div>
          )}
          <div>
            <span className="font-medium text-[var(--compyl-text-muted)]">
              DOM Selector:{" "}
            </span>
            <code className="rounded bg-[var(--compyl-bg)] px-1.5 py-0.5 font-mono text-xs text-[var(--compyl-text)]">
              {bundle.dom_selector}
            </code>
          </div>
          <div>
            <span className="font-medium text-[var(--compyl-text-muted)]">
              Category:{" "}
            </span>
            <span className="text-[var(--compyl-text)]">
              {bundle.category.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <span className="font-medium text-[var(--compyl-text-muted)]">
              Created:{" "}
            </span>
            <span className="text-[var(--compyl-text)]">
              {new Date(bundle.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// DesignCandidateCard — expandable design candidate with ranking signals
// =============================================================================

function DesignCandidateCard({
  candidate,
}: {
  candidate: DeveloperBundle["design_candidates"][number];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-[var(--compyl-border)]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[var(--compyl-bg)]"
      >
        <span className="font-mono font-medium text-[var(--compyl-text)]">
          {candidate.component_name}
        </span>
        {candidate.is_code_connect && (
          <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            Code Connect
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <ConfidenceDot value={candidate.confidence} />
          <span className="text-[var(--compyl-text-muted)]">
            {Math.round(candidate.confidence * 100)}%
          </span>
        </span>
        <span className="text-[var(--compyl-text-muted)]">
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </button>

      {expanded && candidate.ranking_signals && (
        <div className="border-t border-[var(--compyl-border)] px-4 py-3">
          <span className="text-[10px] font-medium uppercase text-[var(--compyl-text-muted)]">
            Ranking Signals
          </span>
          <div className="mt-2 space-y-1">
            {candidate.ranking_signals.map((signal, j) => (
              <div key={j} className="flex items-center gap-2 text-xs">
                <span
                  className={
                    signal.matched
                      ? "text-[var(--compyl-confidence-high)]"
                      : "text-[var(--compyl-text-muted)]"
                  }
                >
                  {signal.matched ? "+" : "-"}
                </span>
                <span className="font-mono text-[var(--compyl-text)]">
                  {signal.signal}
                </span>
                {signal.detail && (
                  <span className="truncate text-[var(--compyl-text-muted)]">
                    {signal.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ConfidenceBar — horizontal progress bar for confidence scores
// =============================================================================

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
      <div className="flex justify-between text-xs text-[var(--compyl-text-muted)]">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-[var(--compyl-bg)]">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
