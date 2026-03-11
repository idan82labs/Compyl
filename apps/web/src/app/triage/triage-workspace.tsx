"use client";

import { useState } from "react";
import { TriageList } from "./triage-list";
import { ActivityTab } from "./activity-tab";

type Tab = "bundles" | "activity";

/**
 * Developer triage workspace — tab container.
 * Wrapped in .dark for Compyl Ember dark palette.
 *
 * Tabs:
 * - Bundles: ExecutionBundle list (default)
 * - Activity: Agent action audit log (developer-only)
 */
export function TriageWorkspace({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("bundles");

  return (
    <div
      className="dark min-h-screen rounded-lg"
      style={{
        backgroundColor: "var(--compyl-bg)",
        color: "var(--compyl-text)",
      }}
    >
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-[var(--compyl-border)]">
        <TabButton
          label="Bundles"
          active={activeTab === "bundles"}
          onClick={() => setActiveTab("bundles")}
        />
        <TabButton
          label="Activity"
          active={activeTab === "activity"}
          onClick={() => setActiveTab("activity")}
        />
      </div>

      {/* Content */}
      {activeTab === "bundles" && <TriageList />}
      {activeTab === "activity" && <ActivityTab projectId={projectId} />}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-[var(--compyl-accent)] text-[var(--compyl-accent)]"
          : "text-[var(--compyl-text-muted)] hover:text-[var(--compyl-text)]"
      }`}
    >
      {label}
    </button>
  );
}
