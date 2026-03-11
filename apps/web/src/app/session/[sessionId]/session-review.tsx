"use client";

import { useEffect, useState } from "react";
import {
  StatusBadge,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@reviewlayer/ui";

// =============================================================================
// Reporter-safe types (matches API response shape)
// =============================================================================

interface ReporterBundle {
  id: string;
  title: string;
  summary: string;
  category: string;
  screenshot_url: string | null;
  client_raw_text: string | null;
  reference_images: string[];
  status: string;
  created_at: string;
}

interface SessionResponse {
  session_id: string;
  project_id: string;
  status: string;
  started_at: string;
  bundles: ReporterBundle[];
}

// =============================================================================
// Category labels (reporter-friendly, no technical terms)
// =============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  visual_bug: "Visual Issue",
  layout_issue: "Layout Issue",
  copy_change: "Text Change",
  feature_request: "Feature Request",
  behavior_bug: "Behavior Issue",
  accessibility: "Accessibility",
  performance: "Performance",
};

// Map bundle statuses to StatusBadge-compatible keys + display labels
const BUNDLE_STATUS_MAP: Record<string, { key: string; label: string }> = {
  pending_review: { key: "pending", label: "Pending Review" },
  approved: { key: "approved", label: "Approved" },
  in_progress: { key: "in_progress", label: "In Progress" },
  resolved: { key: "resolved", label: "Resolved" },
  rejected: { key: "rejected", label: "Rejected" },
};

// Map session-level statuses to StatusBadge-compatible keys + display labels
const SESSION_STATUS_MAP: Record<string, { key: string; label: string }> = {
  active: { key: "success", label: "Active" },
  submitted: { key: "info", label: "Submitted" },
  closed: { key: "resolved", label: "Closed" },
};

// =============================================================================
// Component
// =============================================================================

interface Props {
  sessionId: string;
}

export function SessionReview({ sessionId }: Props) {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase =
      process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

    fetch(`${apiBase}/api/v1/sessions/${sessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Session not found");
          throw new Error(`Failed to load session (${res.status})`);
        }
        return res.json() as Promise<SessionResponse>;
      })
      .then((data) => {
        setSession(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return <LoadingState message="Loading session..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!session) return null;

  return (
    <div>
      <SessionHeader session={session} />
      {session.bundles.length === 0 ? (
        <SessionEmptyState status={session.status} />
      ) : (
        <BundleList bundles={session.bundles} />
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SessionHeader({ session }: { session: SessionResponse }) {
  const mapped = SESSION_STATUS_MAP[session.status];

  return (
    <header className="mb-8 border-b border-stone-200 pb-6">
      <h1 className="text-2xl font-bold text-stone-900">Review Session</h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-stone-600">
        {mapped ? (
          <StatusBadge status={mapped.key} label={mapped.label} />
        ) : (
          <StatusBadge status="info" label={session.status} />
        )}
        <span>
          Started{" "}
          {new Date(session.started_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </header>
  );
}

function SessionEmptyState({ status }: { status: string }) {
  if (status === "active") {
    return (
      <EmptyState
        title="No feedback items yet"
        description="Submit feedback on the site to see items appear here."
      />
    );
  }
  return (
    <EmptyState
      title="Processing feedback"
      description="Your feedback is being analyzed. Items will appear shortly."
    />
  );
}

function BundleList({ bundles }: { bundles: ReporterBundle[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-stone-900">
        Feedback Items ({bundles.length})
      </h2>
      {bundles.map((bundle) => (
        <BundleCard key={bundle.id} bundle={bundle} />
      ))}
    </div>
  );
}

function BundleCard({ bundle }: { bundle: ReporterBundle }) {
  const categoryLabel =
    CATEGORY_LABELS[bundle.category] ?? bundle.category;
  const mapped = BUNDLE_STATUS_MAP[bundle.status];

  return (
    <article className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-stone-900">{bundle.title}</h3>
          <p className="mt-1 text-sm text-stone-600">{bundle.summary}</p>
        </div>
        {bundle.screenshot_url && (
          <img
            src={bundle.screenshot_url}
            alt="Screenshot"
            className="ml-4 h-16 w-24 rounded border border-stone-200 object-cover"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <Badge label={categoryLabel} variant="outline" />
        {mapped ? (
          <StatusBadge status={mapped.key} label={mapped.label} />
        ) : (
          <StatusBadge status="info" label={bundle.status} />
        )}
        <span className="text-stone-400">
          {new Date(bundle.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      {bundle.client_raw_text && (
        <div className="mt-3 rounded bg-stone-50 p-3 text-sm text-stone-700">
          <span className="text-xs font-medium text-stone-500">
            Your feedback:
          </span>
          <p className="mt-1">{bundle.client_raw_text}</p>
        </div>
      )}
    </article>
  );
}
