"use client";

import { useEffect, useState } from "react";

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

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
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
    const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

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
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div>
      <SessionHeader session={session} />
      {session.bundles.length === 0 ? (
        <EmptyState status={session.status} />
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
  const statusClass =
    session.status === "active"
      ? "bg-green-100 text-green-800"
      : session.status === "submitted"
        ? "bg-blue-100 text-blue-800"
        : "bg-gray-100 text-gray-800";

  return (
    <header className="mb-8 border-b pb-6">
      <h1 className="text-2xl font-bold">Review Session</h1>
      <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
        >
          {session.status}
        </span>
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

function EmptyState({ status }: { status: string }) {
  if (status === "active") {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center text-gray-500">
        <p className="text-lg font-medium">No feedback items yet</p>
        <p className="mt-1 text-sm">
          Submit feedback on the site to see items appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center text-gray-500">
      <p className="text-lg font-medium">Processing feedback</p>
      <p className="mt-1 text-sm">
        Your feedback is being analyzed. Items will appear shortly.
      </p>
    </div>
  );
}

function BundleList({ bundles }: { bundles: ReporterBundle[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
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
  const statusLabel = STATUS_LABELS[bundle.status] ?? bundle.status;
  const statusColor =
    STATUS_COLORS[bundle.status] ?? "bg-gray-100 text-gray-800";

  return (
    <article className="rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium">{bundle.title}</h3>
          <p className="mt-1 text-sm text-gray-600">{bundle.summary}</p>
        </div>
        {bundle.screenshot_url && (
          <img
            src={bundle.screenshot_url}
            alt="Screenshot"
            className="ml-4 h-16 w-24 rounded border object-cover"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
          {categoryLabel}
        </span>
        <span className={`rounded px-2 py-0.5 ${statusColor}`}>
          {statusLabel}
        </span>
        <span className="text-gray-400">
          {new Date(bundle.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      {bundle.client_raw_text && (
        <div className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-700">
          <span className="text-xs font-medium text-gray-500">
            Your feedback:
          </span>
          <p className="mt-1">{bundle.client_raw_text}</p>
        </div>
      )}
    </article>
  );
}
