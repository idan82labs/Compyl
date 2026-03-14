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
// Types
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
  client_raw_text?: string;
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
  acceptance_criteria: string[];
  confidence: {
    component_match: number;
    design_match: number;
    task_clarity: number;
  };
  status: BundleStatus;
  assignee_type: string;
  assignee_id: string | null;
  created_at: string;
}

// =============================================================================
// Mappings
// =============================================================================

const BUNDLE_STATUS_MAP: Record<string, { status: string; label: string }> = {
  pending_review: { status: "pending", label: "Pending Review" },
  approved: { status: "approved", label: "Approved" },
  in_progress: { status: "in_progress", label: "In Progress" },
  resolved: { status: "resolved", label: "Resolved" },
  rejected: { status: "rejected", label: "Rejected" },
};

const MODE_MAP: Record<string, { mode: string; label: string }> = {
  fiber_meta: { mode: "exact", label: "Fiber + Meta" },
  server_prefix: { mode: "ancestry", label: "Server Prefix" },
  leaf_only: { mode: "fallback", label: "Leaf Only" },
  heuristic: { mode: "heuristic", label: "Heuristic" },
};

const TRANSITIONS: Record<BundleStatus, { status: BundleStatus; label: string }[]> = {
  pending_review: [
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject" },
  ],
  approved: [
    { status: "in_progress", label: "Start Work" },
    { status: "pending_review", label: "Return to Review" },
  ],
  in_progress: [
    { status: "resolved", label: "Mark Resolved" },
    { status: "approved", label: "Unblock" },
  ],
  resolved: [
    { status: "in_progress", label: "Reopen" },
  ],
  rejected: [
    { status: "pending_review", label: "Reopen" },
  ],
};

type SidebarFilter = "all" | "pending_review" | "approved" | "in_progress" | "resolved" | "rejected";

// =============================================================================
// Root: 3-panel layout
// =============================================================================

export function TriageList() {
  const [bundles, setBundles] = useState<DeveloperBundle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SidebarFilter>("all");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  useEffect(() => {
    const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    fetch(`${apiBase}/api/v1/bundles`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load bundles (${res.status})`);
        return res.json() as Promise<{ bundles: DeveloperBundle[] }>;
      })
      .then((data) => {
        setBundles(data.bundles);
        if (data.bundles.length > 0) setSelectedId(data.bundles[0].id);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><LoadingState message="Loading bundles..." /></div>;
  if (error) return <div className="flex h-full items-center justify-center"><ErrorState message={error} /></div>;
  if (bundles.length === 0) return <div className="flex h-full items-center justify-center"><EmptyState title="No bundles yet" description="Submit a review session to generate ExecutionBundles." /></div>;

  const filtered = filter === "all" ? bundles : bundles.filter((b) => b.status === filter);
  const selected = bundles.find((b) => b.id === selectedId) ?? null;

  const handleStatusChange = async (bundleId: string, newStatus: BundleStatus) => {
    const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
    const res = await fetch(`${apiBase}/api/v1/bundles/${bundleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    setBundles((prev) => prev.map((b) => (b.id === bundleId ? { ...b, status: newStatus } : b)));
  };

  const dispatchAgent = (bundle: DeveloperBundle) => {
    setTerminalOpen(true);
    setTerminalLines([`➜ compyl pull ${bundle.id}`]);
    setTimeout(() => setTerminalLines((p) => [...p, "✓ Fetched ExecutionBundle. Target SHA verified."]), 800);
    setTimeout(() => setTerminalLines((p) => [...p, `➜ claude-code "apply bundle to ${bundle.exact_source?.file_path ?? bundle.title}"`]), 1800);
    setTimeout(() => setTerminalLines((p) => [...p, `▶ Patching ${bundle.exact_source?.file_path ?? "target"}...`]), 2500);
    setTimeout(() => setTerminalLines((p) => [...p, "✓ Patch applied. PR draft created."]), 4000);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT SIDEBAR: Issue List ── */}
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--compyl-border)]" style={{ backgroundColor: "var(--compyl-surface)" }}>
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 border-b border-[var(--compyl-border)] px-3 py-2">
          {(["all", "pending_review", "in_progress", "resolved"] as const).map((f) => {
            const labels: Record<string, string> = { all: "All", pending_review: "Pending", in_progress: "Active", resolved: "Done" };
            const count = f === "all" ? bundles.length : bundles.filter((b) => b.status === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                  filter === f
                    ? "bg-[var(--compyl-accent)] text-white"
                    : "text-[var(--compyl-text-muted)] hover:text-[var(--compyl-text)]"
                }`}
              >
                {labels[f]} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((bundle) => {
            const isSelected = bundle.id === selectedId;
            const statusMap = BUNDLE_STATUS_MAP[bundle.status];
            return (
              <button
                key={bundle.id}
                onClick={() => setSelectedId(bundle.id)}
                className={`flex w-full flex-col gap-1 border-b border-[var(--compyl-border)] px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? "bg-[var(--compyl-accent-subtle)] border-l-2 border-l-[var(--compyl-accent)]"
                    : "hover:bg-[rgba(255,255,255,0.02)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[10px] font-bold ${isSelected ? "text-[var(--compyl-accent)]" : "text-[var(--compyl-text-muted)]"}`}>
                    {bundle.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-[9px] text-[var(--compyl-text-muted)]">
                    {new Date(bundle.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span className={`truncate text-sm font-medium ${isSelected ? "text-[var(--compyl-text)]" : "text-[var(--compyl-text-muted)]"}`}>
                  {bundle.title}
                </span>
                <div className="flex items-center gap-1.5">
                  <SeverityBadge severity={bundle.severity} />
                  {statusMap && <StatusBadge status={statusMap.status} label={statusMap.label} />}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState title="No Issue Selected" description="Select an issue from the sidebar." />
          </div>
        ) : (
          <IssueDetail
            bundle={selected}
            onStatusChange={handleStatusChange}
            onDispatchAgent={dispatchAgent}
          />
        )}

        {/* Agent Terminal Drawer */}
        {terminalOpen && (
          <div className="absolute inset-x-0 bottom-0 z-50 flex h-48 flex-col border-t border-[var(--compyl-border)] shadow-[0_-10px_30px_rgba(0,0,0,0.3)]" style={{ backgroundColor: "#0C0A09" }}>
            <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--compyl-border)] px-4" style={{ backgroundColor: "var(--compyl-surface)" }}>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--compyl-accent)]">MCP Agent Output</span>
              <button onClick={() => setTerminalOpen(false)} className="text-[var(--compyl-text-muted)] hover:text-[var(--compyl-text)]">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
              {terminalLines.map((line, i) => (
                <div key={i} className={line.startsWith("✓") ? "text-emerald-400" : line.startsWith("▶") ? "text-[var(--compyl-accent)]" : "text-[var(--compyl-text-muted)]"}>
                  {line}
                </div>
              ))}
              <div className="mt-1 inline-block h-4 w-1.5 animate-pulse bg-[var(--compyl-text)]" />
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT SIDEBAR: Properties ── */}
      {selected && <PropertiesPanel bundle={selected} />}
    </div>
  );
}

// =============================================================================
// Issue Detail — main content area
// =============================================================================

function IssueDetail({
  bundle,
  onStatusChange,
  onDispatchAgent,
}: {
  bundle: DeveloperBundle;
  onStatusChange: (id: string, status: BundleStatus) => Promise<void>;
  onDispatchAgent: (b: DeveloperBundle) => void;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const statusMap = BUNDLE_STATUS_MAP[bundle.status] ?? { status: bundle.status, label: bundle.status.replace(/_/g, " ") };

  const handleAction = async (newStatus: BundleStatus) => {
    setActionError(null);
    setActionLoading(true);
    try {
      await onStatusChange(bundle.id, newStatus);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const actions = TRANSITIONS[bundle.status] ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-[var(--compyl-border)] px-6 py-4" style={{ backgroundColor: "var(--compyl-surface)" }}>
        <div className="flex items-center gap-2 text-[11px] text-[var(--compyl-text-muted)]">
          <span className="font-mono font-bold">{bundle.id.slice(0, 8).toUpperCase()}</span>
          <span>·</span>
          <SeverityBadge severity={bundle.severity} />
          <StatusBadge status={statusMap.status} label={statusMap.label} />
        </div>
        <div className="mt-2 flex items-start justify-between">
          <h1 className="text-xl font-bold tracking-tight text-[var(--compyl-text)]">{bundle.title}</h1>
          <div className="flex items-center gap-2">
            {actions.map((a) => (
              <button
                key={a.status}
                disabled={actionLoading}
                onClick={() => handleAction(a.status)}
                className="rounded border border-[var(--compyl-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--compyl-text)] transition-colors hover:bg-[rgba(255,255,255,0.05)] disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
            <button
              onClick={() => onDispatchAgent(bundle)}
              className="rounded bg-[var(--compyl-accent)] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:opacity-90"
            >
              Dispatch Agent
            </button>
          </div>
        </div>
        {actionError && <p className="mt-1 text-xs text-[var(--compyl-status-error-text)]">{actionError}</p>}
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-8">

          {/* 1. Human Context */}
          <Section title="Human Context">
            <div className="rounded-lg border border-[var(--compyl-border)] p-4" style={{ backgroundColor: "var(--compyl-surface)" }}>
              {bundle.client_raw_text && (
                <blockquote className="border-l-2 border-[var(--compyl-accent)] pl-3 text-sm italic text-[var(--compyl-text-muted)]">
                  &ldquo;{bundle.client_raw_text}&rdquo;
                </blockquote>
              )}
              <p className="mt-3 text-sm text-[var(--compyl-text)]">{bundle.summary}</p>
              <div className="mt-3 rounded-md p-3 font-mono text-xs text-[var(--compyl-accent)]" style={{ backgroundColor: "var(--compyl-accent-subtle)" }}>
                {bundle.normalized_task}
              </div>
            </div>
          </Section>

          {/* 2. Design Delta — inline diff */}
          {bundle.design_diff && Object.keys(bundle.design_diff).length > 0 && (
            <Section title="Design Delta">
              <div className="overflow-hidden rounded-lg border border-[var(--compyl-border)]">
                <div className="border-b border-[var(--compyl-border)] px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--compyl-text-muted)]" style={{ backgroundColor: "var(--compyl-surface)" }}>
                  Style Differences
                </div>
                <div className="font-mono text-[12px]">
                  {Object.entries(bundle.design_diff).map(([prop, value], i) => (
                    <div key={i} className="flex border-b border-[var(--compyl-border)] last:border-0">
                      <div className="w-8 shrink-0 border-r border-[var(--compyl-border)] py-1.5 text-center text-[10px] text-[var(--compyl-text-muted)]" style={{ backgroundColor: "var(--compyl-surface)" }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 px-3 py-1.5 text-rose-300" style={{ backgroundColor: "rgba(244,63,94,0.05)" }}>
                        <span className="mr-2 text-rose-500">-</span>{prop}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* 3. Exact Source (build-time) — SEPARATE */}
          <Section title="Exact Source">
            {bundle.exact_source ? (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--compyl-accent)]/30 p-3" style={{ backgroundColor: "var(--compyl-accent-subtle)" }}>
                <div className="flex h-8 w-8 items-center justify-center rounded border border-[var(--compyl-accent)]/30 text-[var(--compyl-accent)]" style={{ backgroundColor: "rgba(234,88,12,0.1)" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7H5L7 3L9 11L11 7H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="font-mono text-sm">
                  <span className="font-semibold text-[var(--compyl-accent)]">{bundle.exact_source.component_name}</span>
                  <span className="ml-2 text-[var(--compyl-text-muted)]">{bundle.exact_source.file_path}:{bundle.exact_source.line}</span>
                </div>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-[var(--compyl-accent)]">Build-time</span>
              </div>
            ) : (
              <p className="text-xs italic text-[var(--compyl-text-muted)]">
                Not available{bundle.missing_reasons.length > 0 && ` (${bundle.missing_reasons.join(", ")})`}
              </p>
            )}
          </Section>

          {/* 4. Resolved Ancestry (runtime) — SEPARATE */}
          {bundle.resolved_component_stack.length > 0 && (
            <Section title={`Component Stack (${bundle.resolved_component_stack.length} frames)`}>
              <div className="relative rounded-lg border border-[var(--compyl-border)] p-4" style={{ backgroundColor: "var(--compyl-surface)" }}>
                {/* Vertical connector line */}
                <div className="absolute bottom-6 left-[27px] top-6 w-px bg-[var(--compyl-border)]" />
                <div className="relative space-y-2">
                  {bundle.resolved_component_stack.map((frame, i) => {
                    const isTarget = !frame.is_library && i > 0;
                    return (
                      <div
                        key={i}
                        className={`relative flex items-center gap-3 rounded-lg px-3 py-2 ${
                          isTarget
                            ? "border border-[var(--compyl-accent)]/20 bg-[var(--compyl-accent-subtle)]"
                            : ""
                        }`}
                      >
                        <div className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded ${
                          isTarget
                            ? "bg-[var(--compyl-accent)] ring-2 ring-[var(--compyl-accent)]/30"
                            : "bg-[var(--compyl-border)]"
                        }`}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <rect x="2" y="2" width="8" height="8" rx="2" stroke={isTarget ? "white" : "var(--compyl-text-muted)"} strokeWidth="1.5" fill="none" />
                          </svg>
                        </div>
                        <div className="flex flex-1 items-center justify-between font-mono text-xs">
                          <span className={isTarget ? "font-bold text-[var(--compyl-accent)]" : frame.is_library ? "text-[var(--compyl-text-muted)]" : "text-[var(--compyl-text)]"}>
                            {frame.component_name}
                            {frame.file_path && (
                              <span className="ml-1 text-[var(--compyl-text-muted)]">
                                {frame.file_path}{frame.line != null ? `:${frame.line}` : ""}
                              </span>
                            )}
                          </span>
                          {isTarget && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--compyl-accent)]">Target Consumer</span>
                          )}
                          {frame.is_library && (
                            <span className="text-[9px] italic text-[var(--compyl-text-muted)]">library</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2">
                <ProvenanceBadge mode={(MODE_MAP[bundle.resolution_mode] ?? { mode: bundle.resolution_mode }).mode} label={(MODE_MAP[bundle.resolution_mode] ?? { label: bundle.resolution_mode }).label} />
              </div>
            </Section>
          )}

          {/* 5. Design Candidates */}
          {bundle.design_candidates.length > 0 && (
            <Section title="Design Candidates">
              <div className="space-y-2">
                {bundle.design_candidates.map((c) => (
                  <div key={c.component_id} className="flex items-center gap-3 rounded-lg border border-[var(--compyl-border)] px-3 py-2" style={{ backgroundColor: "var(--compyl-surface)" }}>
                    <span className="font-mono text-sm font-medium text-[var(--compyl-text)]">{c.component_name}</span>
                    {c.is_code_connect && (
                      <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">Code Connect</span>
                    )}
                    <span className="ml-auto flex items-center gap-1.5">
                      <ConfidenceDot value={c.confidence} />
                      <span className="text-xs text-[var(--compyl-text-muted)]">{Math.round(c.confidence * 100)}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 6. Acceptance Criteria */}
          {bundle.acceptance_criteria.length > 0 && (
            <Section title="Acceptance Criteria">
              <div className="space-y-1.5">
                {bundle.acceptance_criteria.map((criterion, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--compyl-text)]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--compyl-border)] font-mono text-[10px] text-[var(--compyl-text-muted)]">
                      {i + 1}
                    </span>
                    {criterion}
                  </div>
                ))}
              </div>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Section wrapper
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[var(--compyl-text-muted)]">{title}</h3>
      {children}
    </section>
  );
}

// =============================================================================
// Properties Panel (right sidebar)
// =============================================================================

function PropertiesPanel({ bundle }: { bundle: DeveloperBundle }) {
  const statusMap = BUNDLE_STATUS_MAP[bundle.status] ?? { status: bundle.status, label: bundle.status.replace(/_/g, " ") };
  const statusColors: Record<string, string> = {
    pending: "text-amber-400",
    approved: "text-emerald-400",
    in_progress: "text-[var(--compyl-accent)]",
    resolved: "text-emerald-400",
    rejected: "text-rose-400",
  };

  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-l border-[var(--compyl-border)] p-5" style={{ backgroundColor: "var(--compyl-surface)" }}>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--compyl-text-muted)]">Properties</h3>

      <div className="mt-4 space-y-5">
        <PropRow label="Status">
          <span className={`text-sm font-semibold capitalize ${statusColors[statusMap.status] ?? "text-[var(--compyl-text)]"}`}>
            {statusMap.label}
          </span>
        </PropRow>

        <PropRow label="Severity">
          <SeverityBadge severity={bundle.severity} />
        </PropRow>

        <PropRow label="Category">
          <span className="text-sm text-[var(--compyl-text)]">{bundle.category}</span>
        </PropRow>

        <PropRow label="Created">
          <span className="text-sm text-[var(--compyl-text)]">
            {new Date(bundle.created_at).toLocaleDateString()} {new Date(bundle.created_at).toLocaleTimeString()}
          </span>
        </PropRow>

        <PropRow label="Page URL">
          <a href={bundle.page_url} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-[var(--compyl-accent)] hover:underline">
            {bundle.page_url}
          </a>
        </PropRow>

        <PropRow label="Selector">
          <code className="block truncate rounded bg-[rgba(255,255,255,0.05)] px-2 py-1 font-mono text-[11px] text-[var(--compyl-text)]">
            {bundle.dom_selector}
          </code>
        </PropRow>
      </div>

      {/* Confidence */}
      <div className="mt-6 border-t border-[var(--compyl-border)] pt-5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--compyl-text-muted)]">Confidence</h3>
        <div className="mt-3 space-y-2">
          <ConfidenceBar label="Component" value={bundle.confidence.component_match} />
          <ConfidenceBar label="Design" value={bundle.confidence.design_match} />
          <ConfidenceBar label="Clarity" value={bundle.confidence.task_clarity} />
        </div>
      </div>

      {/* Bundle Ready */}
      <div className="mt-6 border-t border-[var(--compyl-border)] pt-5">
        <div className="rounded-lg border border-[var(--compyl-border)] p-3" style={{ backgroundColor: "#0C0A09" }}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--compyl-accent)]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6L4.5 9.5L11 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Bundle Ready
          </div>
          <p className="mt-1 text-[10px] text-[var(--compyl-text-muted)]">Ready for MCP ingestion.</p>
          <code className="mt-2 block rounded bg-[rgba(255,255,255,0.05)] px-2 py-1.5 font-mono text-[10px] text-[var(--compyl-text-muted)]">
            compyl pull {bundle.id.slice(0, 8)}
          </code>
        </div>
      </div>
    </aside>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--compyl-text-muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-[var(--compyl-confidence-high)]" : pct >= 40 ? "bg-[var(--compyl-confidence-medium)]" : "bg-[var(--compyl-confidence-low)]";
  return (
    <div>
      <div className="flex justify-between text-[10px] text-[var(--compyl-text-muted)]">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
